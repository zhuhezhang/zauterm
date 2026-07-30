import type { NormalizeImportedSessionResult, SessionImportWarning } from '../../types/common'
import { normalizeTerminalEncoding } from '../../../shared/terminalEncoding'
import { TERMINAL_ENCODING_OPTIONS } from '../terminalEncodingService'
import type { SerialStorageDefaults, SshStorageDefaults } from './defaults'
import type {
  RawImportedSession,
  SavedSession,
  SerialSavedSession,
  SessionType,
  SshSavedSession,
  SessionFormValues,
  TelnetSavedSession,
} from '../../types/session'
import {
  getSessionStorageDefaults,
  SESSION_TYPE_SET,
  AUTH_TYPE_SET,
  BAUD_RATE_SET,
  PARITY_SET,
  PORT_MIN,
  PORT_MAX,
} from './defaults'
import {
  normalizeBackspaceMode,
  clampSessionPort,
  buildSessionLabel,
  validateSessionGroupLabel,
  pickSessionStorageFields,
} from './utils'

/** 允许的终端编码的值集合 */
const ALLOWED_TERMINAL_ENCODINGS = new Set(TERMINAL_ENCODING_OPTIONS.map((o) => o.value))

/**
 * 判断是否为原始会话对象
 * @param raw 原始会话对象
 * @returns 是否为原始会话对象
 */
function isPlainObject(raw: unknown): raw is RawImportedSession {
  return raw != null && typeof raw === 'object' && !Array.isArray(raw)
}

/**
 * 解析导入 JSON 中的终端编码字段。
 *
 * 导入文件可能缺少 encoding、类型错误，或填写了应用不支持的编码名。
 * 本函数在尽量保留合法值的同时，对无效输入回退到会话类型默认值并记录警告，
 * 避免导入后终端解码异常。
 * @param raw 原始会话对象
 * @param fallback 默认编码
 * @param warnings 警告列表
 * @returns 返回解析后的编码
 */
function resolveImportedEncoding(
  raw: RawImportedSession,
  fallback: string,
  warnings: SessionImportWarning[],
): string {
  const baseEnc = normalizeTerminalEncoding(fallback)

  // 未提供 encoding：静默使用默认值，不记警告（与 ConnectDialog 缺省行为一致）
  if (raw.encoding === undefined) {
    return baseEnc
  }

  // 非字符串或空串：无法解析，回退并警告
  if (typeof raw.encoding !== 'string' || !raw.encoding.trim()) {
    warnings.push({ code: 'fieldDefaulted', params: {
      field: 'encoding',
      value: String(raw.encoding ?? ''),
      result: baseEnc,
    }})
    return baseEnc
  }

  // 规范化别名（如 gb2312 → gbk）后校验是否在 TERMINAL_ENCODING_OPTIONS 白名单内
  const norm = normalizeTerminalEncoding(raw.encoding)
  if (!ALLOWED_TERMINAL_ENCODINGS.has(norm)) {
    warnings.push({ code: 'fieldDefaulted', params: {
      field: 'encoding',
      value: raw.encoding,
      result: baseEnc,
    }})
    return baseEnc
  }

  return norm
}

/**
 * 将 Serial 会话的串口参数字段写入 merged，并对非法值回退到 base 默认值。
 *
 * 各字段采用相同策略：若 JSON 中存在该键则尝试解析/校验；
 * 校验失败时 push fieldDefaulted 警告并使用 base 中的默认值；
 * 若键不存在则直接使用 base 默认值（不记警告）。
 * @param merged 合并的 Serial 存储字段
 * @param item 原始会话对象
 * @param base 默认值
 * @param warnings 警告列表
 */
function applySerialStorageFieldsWithWarnings(
  merged: Partial<SerialSavedSession>,
  item: RawImportedSession,
  base: SerialStorageDefaults,
  warnings: SessionImportWarning[],
): void {
  // path 在 normalizeImportedSession 入口已校验非空，此处仅 trim
  merged.path = String(item.path).trim()

  // 波特率：须为有限整数且落在 BAUD_RATES 预设列表中
  if ('baudRate' in item && item.baudRate !== undefined) {
    const baud = parseInt(String(item.baudRate), 10)
    if (!Number.isFinite(baud) || !BAUD_RATE_SET.has(String(baud))) {
      warnings.push({ code: 'fieldDefaulted', params: {
        field: 'baudRate',
        value: String(item.baudRate),
        result: String(base.baudRate ?? ''),
      }})
      merged.baudRate = base.baudRate
    } else {
      merged.baudRate = baud
    }
  } else {
    merged.baudRate = base.baudRate
  }

  // 数据位：须为有限整数（具体合法范围由硬件层约束，此处只做数值解析）
  if ('dataBits' in item && item.dataBits !== undefined) {
    const dataBits = parseInt(String(item.dataBits), 10)
    if (!Number.isFinite(dataBits)) {
      warnings.push({ code: 'fieldDefaulted', params: {
        field: 'dataBits',
        value: String(item.dataBits),
        result: String(base.dataBits ?? ''),
      }})
      merged.dataBits = base.dataBits
    } else {
      merged.dataBits = dataBits
    }
  } else {
    merged.dataBits = base.dataBits
  }

  // 停止位：须为有限整数
  if ('stopBits' in item && item.stopBits !== undefined) {
    const stopBits = parseInt(String(item.stopBits), 10)
    if (!Number.isFinite(stopBits)) {
      warnings.push({ code: 'fieldDefaulted', params: {
        field: 'stopBits',
        value: String(item.stopBits),
        result: String(base.stopBits ?? ''),
      }})
      merged.stopBits = base.stopBits
    } else {
      merged.stopBits = stopBits
    }
  } else {
    merged.stopBits = base.stopBits
  }

  // 校验位：转小写后须在 PARITIES 白名单内（none/even/odd/mark/space）
  if ('parity' in item && item.parity !== undefined) {
    const parity = String(item.parity).toLowerCase()
    if (!PARITY_SET.has(parity)) {
      warnings.push({ code: 'fieldDefaulted', params: {
        field: 'parity',
        value: String(item.parity),
        result: String(base.parity ?? ''),
      }})
      merged.parity = base.parity
    } else {
      merged.parity = parity
    }
  } else {
    merged.parity = base.parity
  }
}

/**
 * 将导入 JSON 中的单条原始会话规范为 SavedSession 结构。
 *
 * 整体流程对齐 ConnectDialog.buildConfig + 保存会话：
 * 1. 结构/类型/必填字段校验 → 失败则 ok:false 并返回 reason（跳过该条，不中断整批导入）
 * 2. 分组/标签合法性校验（与连接对话框相同规则）
 * 3. 解析各类型共用的 encoding、backspaceMode、savedId、savedAt、label
 * 4. 按 ssh / telnet / serial 分支组装类型专有字段，非法值回退默认并记 fieldDefaulted 警告
 * 5. pickSessionStorageFields 剔除不应持久化的字段（如明文密码），再补回 savedId/savedAt
 * @param raw 原始会话对象
 * @returns 返回规范后的会话
 */
export function normalizeImportedSession(raw: unknown): NormalizeImportedSessionResult {
  const warnings: SessionImportWarning[] = []

  // --- 1. 基础结构校验 ---
  if (!isPlainObject(raw)) {
    return { ok: false, reason: 'notObject' }
  }
  const item = raw
  const type = String(item.type ?? '').trim().toLowerCase() as SessionType
  if (!SESSION_TYPE_SET.has(type)) return { ok: false, reason: 'invalidType' }

  // 各类型必填连接参数：ssh/telnet 需 host，serial 需 path
  if (type === 'ssh' || type === 'telnet') {
    if (!String(item.host ?? '').trim()) return { ok: false, reason: 'missingHost' }
  }
  if (type === 'serial') {
    if (!String(item.path ?? '').trim()) return { ok: false, reason: 'missingPath' }
  }

  // --- 2. 分组/标签校验（非法字符、首尾斜杠等）---
  const group = String(item.group ?? '').trim()
  const labelInput = String(item.label ?? '').trim()
  const glErr = validateSessionGroupLabel(group, labelInput)
  if (glErr) return { ok: false, reason: glErr }

  // --- 3. 各类型共用字段 ---
  const base = getSessionStorageDefaults(type)
  const encoding = resolveImportedEncoding(
    item,
    String(base.encoding ?? ''),
    warnings,
  )

  let backspaceMode = 'auto'
  if ('backspaceMode' in item && item.backspaceMode !== undefined) {
    const bm = normalizeBackspaceMode(item.backspaceMode)
    if (bm === null) {
      warnings.push({ code: 'fieldDefaulted', params: {
        field: 'backspaceMode',
        value: String(item.backspaceMode),
        result: 'auto',
      }})
    } else {
      backspaceMode = bm
    }
  }

  // savedId：缺失时生成唯一 ID，保证合并导入时可去重
  const savedId = typeof item.savedId === 'string' && item.savedId.trim()
    ? item.savedId.trim()
    : `saved-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  const savedAt = Number.isFinite(Number(item.savedAt)) ? Number(item.savedAt) : Date.now()
  if ('savedAt' in item && !Number.isFinite(Number(item.savedAt))) {
    warnings.push({ code: 'fieldDefaulted', params: {
      field: 'savedAt',
      value: String(item.savedAt),
      result: savedAt,
    }})
  }

  // label 为空时按 host/username/path 自动生成（与新建连接时一致）
  const label = labelInput || buildSessionLabel(type, { ...item, type } as SessionFormValues)

  let session: SavedSession

  // --- 4. 按会话类型组装专有字段 ---
  if (type === 'ssh') {
    const sshBase = getSessionStorageDefaults('ssh') as SshStorageDefaults
    const port = clampSessionPort(item.port, 22)
    // 显式提供了 port 但超出 0–65535 或非数字时记警告
    if ('port' in item && item.port !== '' && item.port != null) {
      const rawN = typeof item.port === 'number' ? item.port : parseInt(String(item.port), 10)
      if (!Number.isFinite(rawN) || rawN < PORT_MIN || rawN > PORT_MAX) {
        warnings.push({ code: 'fieldDefaulted', params: {
          field: 'port',
          value: String(item.port),
          result: port,
        }})
      }
    }

    let authType = sshBase.authType
    if ('authType' in item && item.authType !== undefined) {
      const auth = String(item.authType).trim()
      authType = AUTH_TYPE_SET.has(auth) ? auth : 'password'
      if (!AUTH_TYPE_SET.has(auth)) {
        warnings.push({ code: 'fieldDefaulted', params: {
          field: 'authType',
          value: auth,
          result: 'password',
        }})
      }
    }

    let enableSftp = sshBase.enableSftp
    if ('enableSftp' in item && item.enableSftp !== undefined) {
      enableSftp = Boolean(item.enableSftp)
      // 非 boolean 类型（如字符串 "true"）会强制转换，同时记警告
      if (typeof item.enableSftp !== 'boolean') {
        warnings.push({ code: 'fieldDefaulted', params: {
          field: 'enableSftp',
          value: String(item.enableSftp),
          result: String(enableSftp),
        }})
      }
    }

    const sshSession: SshSavedSession = {
      type: 'ssh',
      savedId,
      savedAt,
      group,
      label,
      encoding,
      backspaceMode,
      host: String(item.host).trim(),
      port,
      username: String(item.username ?? '').trim(),
      authType,
      enableSftp,
    }
    // 凭据字段仅在为 string 时保留，供后续 absorbSecrets 迁入 vault
    if (typeof item.password === 'string') sshSession.password = item.password
    if (typeof item.privateKey === 'string') sshSession.privateKey = item.privateKey
    if (typeof item.passphrase === 'string') sshSession.passphrase = item.passphrase
    session = pickSessionStorageFields(sshSession) as SshSavedSession
    // pickSessionStorageFields 会剥离 savedId/savedAt，需重新写回
    session.savedId = savedId
    session.savedAt = savedAt
  } else if (type === 'telnet') {
    const port = clampSessionPort(item.port, 23)
    if ('port' in item && item.port !== '' && item.port != null) {
      const rawN = typeof item.port === 'number' ? item.port : parseInt(String(item.port), 10)
      if (!Number.isFinite(rawN) || rawN < PORT_MIN || rawN > PORT_MAX) {
        warnings.push({ code: 'fieldDefaulted', params: {
          field: 'port',
          value: String(item.port),
          result: port,
        }})
      }
    }

    const telnetSession: TelnetSavedSession = {
      type: 'telnet',
      savedId,
      savedAt,
      group,
      label,
      encoding,
      backspaceMode,
      host: String(item.host).trim(),
      port,
    }
    session = pickSessionStorageFields(telnetSession) as TelnetSavedSession
    session.savedId = savedId
    session.savedAt = savedAt
  } else {
    const serialBase = getSessionStorageDefaults('serial') as SerialStorageDefaults
    const serialFields: Partial<SerialSavedSession> = { type: 'serial' }
    applySerialStorageFieldsWithWarnings(serialFields, item, serialBase, warnings)

    const serialSession: SerialSavedSession = {
      type: 'serial',
      savedId,
      savedAt,
      group,
      label,
      encoding,
      backspaceMode,
      path: serialFields.path,
      baudRate: serialFields.baudRate,
      dataBits: serialFields.dataBits,
      stopBits: serialFields.stopBits,
      parity: serialFields.parity,
    }
    session = pickSessionStorageFields(serialSession) as SerialSavedSession
    session.savedId = savedId
    session.savedAt = savedAt
  }

  return { ok: true, session, warnings }
}
