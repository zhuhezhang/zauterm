import type { SettingsImportWarning } from '../../types/common'
import type { AppSettings, HighlightRule } from '../../types/settings'
import { resolveEffectiveUiLanguage } from '../resolveUiLanguage'
import { resolveHighlightRuleId, resolveHighlightRuleName } from './highlightRules'
import { pushSettingsImportWarning } from './importWarnings'
import {
  DEFAULT_SETTINGS, SSH_ALGORITHM_SECTION_KEYS, TERMINAL_SCROLLBACK_MIN, 
  TERMINAL_SCROLLBACK_MAX, SSH_KEEPALIVE_INTERVAL_MIN, SSH_KEEPALIVE_INTERVAL_MAX 
} from './defaults'
import { TERMINAL_FONT_FAMILY_OPTIONS } from '../../../shared/terminalFonts'
import {
  clampSidebarWidthPx, clampTerminalScrollback, normalizeImportedLogPath, normalizeLoggingMode,
  clampSshKeepaliveInterval,
} from './normalize'
import {
  DEFAULT_ALGORITHM_SELECTION,
  SSH_ALGORITHM_OPTION_POOL,
  type AlgorithmCategory,
  type AlgorithmPreferences,
} from '../../../shared/sshAlgorithmDefaults'

/**
 * 判断是否为纯对象
 * @param raw 待判断的对象
 * @returns 是否为纯对象
 */
function isPlainObject(raw: unknown): raw is Record<string, unknown> {
  return raw != null && typeof raw === 'object' && !Array.isArray(raw)
}

/**
 * 深拷贝当前设置，作为导入合并基底（缺字段时用 DEFAULT_SETTINGS 补齐）
 * @param {Record<string, unknown>} current 当前应用设置
 * @returns 深拷贝后的设置
 */
function cloneCurrentSettings(current: Partial<AppSettings>): AppSettings {
  const base = { ...DEFAULT_SETTINGS, ...current }
  return {
    ...base,
    highlightRules: Array.isArray(base.highlightRules)
      ? base.highlightRules.map((r) => ({ ...r }))
      : DEFAULT_SETTINGS.highlightRules.map((r) => ({ ...r })),
    algorithmPreferences: {
      ...DEFAULT_ALGORITHM_SELECTION,
      ...(isPlainObject(base.algorithmPreferences) ? base.algorithmPreferences : {}),
    },
  }
}

/** 导入高亮规则时 enabled / useRegex / caseSensitive / color 的默认值（与设置界面新建规则一致） */
const HIGHLIGHT_RULE_FIELD_DEFAULTS = {
  /** 是否启用 */
  enabled: true,
  /** 是否使用正则表达式 */
  useRegex: true,
  /** 是否区分大小写 */
  caseSensitive: false,
  /** 颜色 */
  color: '#ffcc00',
}

/**
 * 收集现有规则的 id / name（trim 后），用于导入去重
 * @param rules 现有高亮规则列表
 * @returns 现有规则的 id 和 name 集合
 */
function collectHighlightRuleKeys(rules: unknown[]): { ids: Set<string>; names: Set<string> } {
  const ids = new Set<string>()
  const names = new Set<string>()
  for (const r of rules) {
    if (!isPlainObject(r)) continue
    if (typeof r.id === 'string' && r.id.trim()) ids.add(r.id.trim())
    if (typeof r.name === 'string' && r.name.trim()) names.add(r.name.trim())
  }
  return { ids, names }
}

/**
 * 导入时规范布尔字段：仅接受 boolean，否则用默认值
 * @param raw 原始值
 * @param fallback 默认值
 * @returns 规范化后的布尔值
 */
function normalizeImportedHighlightBoolean(raw: unknown, fallback: boolean): boolean {
  return typeof raw === 'boolean' ? raw : fallback
}

/**
 * 导入时规范颜色：非字符串或 trim 后为空则用默认值
 * @param raw 原始值
 * @param fallback 默认值
 * @returns 规范化后的颜色
 */
function normalizeImportedHighlightColor(raw: unknown, fallback: string): string {
  if (typeof raw !== 'string') return fallback
  const c = raw.trim()
  return c || fallback
}

/**
 * 获取高亮规则的拒绝原因
 * @param raw 原始高亮规则
 * @returns 拒绝原因码；null 表示可继续规范化
 */
function getHighlightRuleRejectReason(raw: unknown): string | null {
  if (!isPlainObject(raw)) return 'invalidFormat'
  if (typeof raw.pattern !== 'string' || !raw.pattern) return 'missingPattern'
  const useRegex = normalizeImportedHighlightBoolean(raw.useRegex, HIGHLIGHT_RULE_FIELD_DEFAULTS.useRegex)
  if (useRegex) {
    try {
      new RegExp(raw.pattern)
    } catch {
      return 'invalidRegex'
    }
  }
  return null
}

/**
 * 规范化导入的高亮规则：pattern 须有效；id 由调用方解析；其余字段缺省或非法时用默认值
 * @param raw 待规范的高亮规则
 * @param id 已解析的规则 id
 * @returns 规范化后的高亮规则
 */
function normalizeImportedHighlightRule(raw: unknown, id: string): HighlightRule | null {
  if (getHighlightRuleRejectReason(raw)) return null
  const r = raw as Record<string, unknown>
  const pattern = r.pattern
  const enabled = normalizeImportedHighlightBoolean(r.enabled, HIGHLIGHT_RULE_FIELD_DEFAULTS.enabled)
  const useRegex = normalizeImportedHighlightBoolean(r.useRegex, HIGHLIGHT_RULE_FIELD_DEFAULTS.useRegex)
  const caseSensitive = normalizeImportedHighlightBoolean(
    r.caseSensitive,
    HIGHLIGHT_RULE_FIELD_DEFAULTS.caseSensitive,
  )
  const color = normalizeImportedHighlightColor(r.color, HIGHLIGHT_RULE_FIELD_DEFAULTS.color)
  return {
    id,
    enabled,
    useRegex,
    caseSensitive,
    pattern: String(pattern),
    color,
    name: String(r.name ?? ''),
  }
}

/**
 * 将导入文件中的高亮规则合并到当前列表（追加模式，不覆盖已有规则）。
 *
 * 每条导入规则依次经过：格式校验 → id 去重 → 字段规范化 → name 去重/自动命名，
 * 任一环节失败则跳过该条并记 highlightRuleSkipped 警告，不影响其余规则与现有列表。
 * @param imported 导入文件中的规则数组
 * @param currentRules 当前高亮规则列表
 * @param lang 界面语言
 * @param warnings 导入警告列表
 * @returns 规范化后的高亮规则列表
 */
function mergeImportedHighlightRules(
  imported: unknown[],
  currentRules: HighlightRule[],
  lang: 'zh' | 'en',
  warnings: SettingsImportWarning[],
): HighlightRule[] {
  const base = currentRules.map((r) => ({ ...r }))
  const { ids, names } = collectHighlightRuleKeys(base)

  imported.forEach((raw, index) => {
    const oneBased = index + 1

    // pattern 缺失、格式非法或正则无效 → 整条跳过
    const reject = getHighlightRuleRejectReason(raw)
    if (reject) {
      pushSettingsImportWarning(warnings, 'highlightRuleSkipped', { index: oneBased, reason: reject })
      return
    }

    // 解析 id：保留合法 id，冲突或缺失时生成新 id
    const id = resolveHighlightRuleId(
      isPlainObject(raw) ? raw.id : undefined,
      ids,
    )
    if (ids.has(id)) {
      pushSettingsImportWarning(warnings, 'highlightRuleSkipped', {
        index: oneBased, reason: 'duplicateId', id,
      })
      return
    }

    const rule = normalizeImportedHighlightRule(raw, id)
    if (!rule) return

    // 名称为空时自动生成「未命名规则 n」；与现有 name 冲突则跳过
    const name = resolveHighlightRuleName(rule.name, names, lang)
    if (names.has(name)) {
      pushSettingsImportWarning(warnings, 'highlightRuleSkipped', {
        index: oneBased, reason: 'duplicateName', name,
      })
      return
    }

    base.push({ ...rule, name })
    ids.add(rule.id)
    names.add(name)
  })

  return base
}

/**
 * 规范化 SSH 算法偏好各段（kex / hostKey / cipher 等）。
 *
 * 以 current 为基底，仅处理导入 JSON 中显式出现的段：
 * - 段值非数组 → 保留 current 对应段，记 algorithmSectionInvalidType
 * - 数组中无合法算法名 → 保留 current 对应段，记 algorithmSectionAllInvalid
 * - 部分条目不在白名单 → 过滤后写入，记 algorithmSectionPartialInvalid
 * - 段未出现在导入文件中 → 不改动 current 值
 * @param raw 导入文件中的算法偏好
 * @param current 当前算法偏好
 * @param warnings 导入警告列表
 * @returns 规范化后的算法偏好
 */
function normalizeAlgorithmPreferences(
  raw: unknown,
  current: AlgorithmPreferences,
  warnings: SettingsImportWarning[],
): AlgorithmPreferences {
  const base = {
    ...DEFAULT_ALGORITHM_SELECTION,
    ...(isPlainObject(current) ? current : {}),
  }
  if (!isPlainObject(raw)) return base

  const out = { ...base }
  for (const key of SSH_ALGORITHM_SECTION_KEYS as AlgorithmCategory[]) {
    if (!(key in raw)) continue

    const rawSection = (raw as Record<string, unknown>)[key]
    if (!Array.isArray(rawSection)) {
      pushSettingsImportWarning(warnings, 'algorithmSectionInvalidType', { section: key })
      continue
    }

    const pool = SSH_ALGORITHM_OPTION_POOL[key]
    const rawList = rawSection
    // 仅保留字符串且在该段算法白名单内的条目
    const picked = rawList.filter((v) => typeof v === 'string' && pool.includes(v))
    const unique = [...new Set(picked)]

    if (!unique.length) {
      // 数组非空但全部非法 → 保留 base 中该段，记警告
      if (rawList.length > 0) {
        pushSettingsImportWarning(warnings, 'algorithmSectionAllInvalid', { section: key })
      }
      continue
    }

    const skipped = rawList.length - unique.length
    if (skipped > 0) {
      pushSettingsImportWarning(warnings, 'algorithmSectionPartialInvalid', { section: key, skipped })
    }
    out[key] = unique
  }
  return out
}

/** 应用主题的值集合 */
const APP_THEME_SET = new Set(['dark', 'light', 'auto'])
/** 界面语言的值集合 */
const UI_LANGUAGE_SET = new Set(['auto', 'en', 'zh'])
/** 日志模式的值集合 */
const LOGGING_MODE_SET = new Set(['none', 'stream', 'buffer'])
/** 终端字体 preset 的值集合 */
const TERMINAL_FONT_FAMILY_SET = new Set<string>(TERMINAL_FONT_FAMILY_OPTIONS.map((o) => o.value))

/** 布尔设置项的键 */
const BOOLEAN_SETTING_KEYS: (keyof AppSettings)[] = [
  'confirmDeleteSession',
  'confirmDeleteGroup',
  'deleteGroupWithSessions',
  'terminalInteract',
  'saveSecretsToVault',
]

/**
 * 将导入 JSON 规范为安全的 AppSettings（合并到 current，而非全量替换）。
 *
 * 整体策略：
 * 1. 仅保留 DEFAULT_SETTINGS 中已知的键，剥离未知字段
 * 2. 导入文件中未出现的键保持 current 不变
 * 3. 出现的键按类型逐项校验：枚举 / 布尔 / 数值 clamp / 路径 / 复合对象
 * 4. 非法值回退到 current 对应项并记 SettingsImportWarning
 *
 * highlightRules 为追加合并；algorithmPreferences 按段局部覆盖。
 * @param raw 导入文件
 * @param currentSettings 当前设置
 * @returns 规范化后的设置和警告列表
 */
export async function sanitizeImportedSettings(
  raw: unknown,
  currentSettings: AppSettings,
): Promise<{ settings: AppSettings; warnings: SettingsImportWarning[] }> {
  const warnings: SettingsImportWarning[] = []
  const current = cloneCurrentSettings(currentSettings)

  // 非对象输入：直接返回 current 副本，不产生警告（由上层 parse 阶段拦截）
  if (!isPlainObject(raw)) {
    return { settings: current, warnings }
  }

  // 白名单键过滤：只接受 DEFAULT_SETTINGS 中定义的字段
  const stripped: Record<string, unknown> = {}
  for (const key of Object.keys(DEFAULT_SETTINGS)) {
    if (key in raw) stripped[key] = raw[key]
  }

  let out: AppSettings = { ...current, ...stripped } as AppSettings

  // --- 枚举类字段：非法值回退 current ---
  if ('appTheme' in stripped) {
    const v = String(out.appTheme)
    if (!APP_THEME_SET.has(v)) {
      out.appTheme = current.appTheme
      pushSettingsImportWarning(warnings, 'invalidEnum', { field: 'appTheme', value: v })
    }
  }
  if ('uiLanguage' in stripped) {
    const v = String(out.uiLanguage)
    if (!UI_LANGUAGE_SET.has(v)) {
      out.uiLanguage = current.uiLanguage
      pushSettingsImportWarning(warnings, 'invalidEnum', { field: 'uiLanguage', value: v })
    }
  }
  if ('terminalFontFamily' in stripped) {
    const v = String(out.terminalFontFamily ?? '').trim().toLowerCase()
    if (!TERMINAL_FONT_FAMILY_SET.has(v)) {
      out.terminalFontFamily = current.terminalFontFamily
      pushSettingsImportWarning(warnings, 'invalidEnum', { field: 'terminalFontFamily', value: String(stripped.terminalFontFamily ?? '') })
    } else {
      out.terminalFontFamily = v as AppSettings['terminalFontFamily']
    }
  }

  // --- 布尔字段：非 boolean 类型回退 current ---
  for (const key of BOOLEAN_SETTING_KEYS) {
    if (!(key in stripped)) continue
    if (typeof stripped[key] !== 'boolean') {
      ;(out as unknown as Record<string, unknown>)[key] = current[key]
      pushSettingsImportWarning(warnings, 'invalidBoolean', { field: key })
    }
  }

  // --- 数值字段：clamp 到合法范围，越界时记 valueClamped ---
  if ('terminalScrollback' in stripped) {
    const rawVal = stripped.terminalScrollback
    const next = clampTerminalScrollback(rawVal, current.terminalScrollback)
    out.terminalScrollback = next
    const n = Math.floor(Number(rawVal))
    if (!Number.isFinite(n) || n < TERMINAL_SCROLLBACK_MIN || n > TERMINAL_SCROLLBACK_MAX) {
      pushSettingsImportWarning(warnings, 'valueClamped', {
        field: 'terminalScrollback',
        value: String(rawVal),
        result: next,
      })
    }
  }
  if ('sshKeepaliveInterval' in stripped) {
    const rawVal = stripped.sshKeepaliveInterval
    const next = clampSshKeepaliveInterval(rawVal, current.sshKeepaliveInterval)
    out.sshKeepaliveInterval = next
    const n = Math.floor(Number(rawVal))
    if (!Number.isFinite(n) || n < SSH_KEEPALIVE_INTERVAL_MIN || n > SSH_KEEPALIVE_INTERVAL_MAX) {
      pushSettingsImportWarning(warnings, 'valueClamped', {
        field: 'sshKeepaliveInterval',
        value: String(rawVal),
        result: next,
      })
    }
  }

  // --- loggingMode：小写化后校验枚举 ---
  if ('loggingMode' in stripped) {
    const v = String(stripped.loggingMode ?? '').trim().toLowerCase()
    if (!LOGGING_MODE_SET.has(v)) {
      out.loggingMode = current.loggingMode
      pushSettingsImportWarning(warnings, 'invalidEnum', { field: 'loggingMode', value: String(stripped.loggingMode ?? '') })
    } else {
      out.loggingMode = v as AppSettings['loggingMode']
    }
  }

  // --- logPath：异步校验路径合法性（IPC 探测），非 string 或路径被拒时回退 ---
  if ('logPath' in stripped) {
    const fallback = String(current.logPath ?? '')
    const importedRaw = stripped.logPath
    if (typeof importedRaw !== 'string') {
      out.logPath = await normalizeImportedLogPath(importedRaw, fallback)
      pushSettingsImportWarning(warnings, 'logPathNotString', { field: 'logPath' })
    } else {
      const trimmed = importedRaw.trim()
      const next = await normalizeImportedLogPath(importedRaw, fallback)
      out.logPath = next
      // 用户提供了非空路径但被 normalize 拒绝（不存在/无权限等）→ 回退 fallback 并警告
      if (trimmed && next === fallback && trimmed !== fallback) {
        pushSettingsImportWarning(warnings, 'logPathRejected', { field: 'logPath', value: trimmed })
      }
    }
  }

  // --- sidebarWidth：按当前窗口宽度 clamp ---
  if ('sidebarWidth' in stripped) {
    const rawVal = stripped.sidebarWidth
    const innerW = typeof window !== 'undefined' ? window.innerWidth : 1200
    const next = clampSidebarWidthPx(
      rawVal,
      innerW,
      current.sidebarWidth,
    )
    out.sidebarWidth = next
    const w = Math.floor(Number(rawVal))
    if (!Number.isFinite(w) || w !== next) {
      pushSettingsImportWarning(warnings, 'valueClamped', {
        field: 'sidebarWidth',
        value: String(rawVal),
        result: next,
      })
    }
  }

  // --- 复合对象：高亮规则追加合并 ---
  if ('highlightRules' in stripped) {
    if (!Array.isArray(stripped.highlightRules)) {
      out.highlightRules = current.highlightRules.map((r) => ({ ...r }))
      pushSettingsImportWarning(warnings, 'highlightRulesNotArray')
    } else {
      const importLang = resolveEffectiveUiLanguage(
        'uiLanguage' in stripped ? String(out.uiLanguage) : String(current.uiLanguage ?? 'auto'),
      )
      out.highlightRules = mergeImportedHighlightRules(
        stripped.highlightRules,
        current.highlightRules,
        importLang,
        warnings,
      )
    }
  }

  // --- 复合对象：SSH 算法偏好按段合并 ---
  if ('algorithmPreferences' in stripped) {
    if (!isPlainObject(stripped.algorithmPreferences)) {
      out.algorithmPreferences = {
        ...DEFAULT_ALGORITHM_SELECTION,
        ...(isPlainObject(current.algorithmPreferences) ? current.algorithmPreferences : {}),
      }
      pushSettingsImportWarning(warnings, 'algorithmPreferencesNotObject')
    } else {
      out.algorithmPreferences = normalizeAlgorithmPreferences(
        stripped.algorithmPreferences,
        current.algorithmPreferences,
        warnings,
      )
    }
  }

  // 最终统一规范化 loggingMode（处理依赖 logPath 的联动逻辑）
  out.loggingMode = normalizeLoggingMode(out.loggingMode)

  return { settings: out, warnings }
}
