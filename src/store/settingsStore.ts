import { DEFAULT_ALGORITHM_SELECTION } from '../../shared/sshAlgorithmDefaults'
import type { AppSettings } from '../types/settings'
import type { TranslateFn } from '../types/common'
import { syncUiLanguageToMain } from '../lib/resolveUiLanguage'
import { downloadJsonExport } from '../lib/import/downloadJsonExport'
import { DEFAULT_SETTINGS } from '../lib/settings/defaults'
import { normalizeTerminalFontFamilyKey } from '../../shared/terminalFonts'
import { ipcPathFromResponse } from '../lib/ipc/ipcResponse'
import {
  clampSidebarWidthPx, clampTerminalScrollback, normalizeLoggingMode, clampSshKeepaliveInterval,
} from '../lib/settings/normalize'

/** 本地存储设置的键名 */
const SETTINGS_KEY = 'zterm_settings'
/** 默认放在系统下载目录下的日志子文件夹名 */
export const LOG_PATH_SUBFOLDER = 'zterm-session-log'

/** 由 app:getDownloadsPath invoke 填充的系统下载目录缓存 */
let cachedDownloadsPath = ''

/**
 * 拉取并缓存系统下载目录（app:getDownloadsPath）
 * @returns 系统下载目录
 */
export async function refreshDownloadsPathCache() {
  try {
    const res = await window?.zterm?.paths?.getDownloadsPath?.()
    cachedDownloadsPath = ipcPathFromResponse(res)
  } catch {
    cachedDownloadsPath = ''
  }
  return cachedDownloadsPath
}

/**
 * 获取已缓存的系统下载目录
 * @returns 已缓存的系统下载目录
 */
export function getDownloadsPathCached() {
  return cachedDownloadsPath
}

/**
 * 将下载根目录拼成默认日志子目录路径
 * @param base 系统下载目录
 * @returns 默认日志子目录路径
 */
function buildDefaultLogPathFromBase(base: string) {
  if (!base || typeof base !== 'string') return ''
  const trimmed = base.replace(/[/\\]+$/, '')
  const sep = trimmed.includes('\\') ? '\\' : '/'
  return `${trimmed}${sep}${LOG_PATH_SUBFOLDER}`
}

/**
 * 默认日志目录：系统下载目录下的 zterm-session-log（需先 refreshDownloadsPathCache）
 * @returns 默认日志目录
 */
export function getDefaultLogPath() {
  return buildDefaultLogPathFromBase(cachedDownloadsPath)
}

/**
 * 解析实际用于写入日志的目录：自定义路径优先，否则为默认子目录，再否则退回下载根目录
 * @param [settings] 当前应用设置
 * @returns 实际用于写入日志的目录
 */
export function resolveLoggingDirectory(settings?: Pick<AppSettings, 'logPath'>) {
  try {
    const custom = settings?.logPath != null ? String(settings.logPath).trim() : ''
    if (custom) return custom
    return getDefaultLogPath() || cachedDownloadsPath || ''
  } catch {
    return ''
  }
}

/**
 * 加载设置项，从 localStorage 获取并解析 JSON，如果失败则返回默认设置
 * @returns 设置项对象
 */
export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    const saved = raw ? JSON.parse(raw) : {}
    if (saved.algorithmPreferences && typeof saved.algorithmPreferences === 'object') {
      saved.algorithmPreferences = {
        ...DEFAULT_ALGORITHM_SELECTION,
        ...saved.algorithmPreferences,
      }
    }
    let merged = { ...DEFAULT_SETTINGS, ...saved }
    merged.terminalScrollback = clampTerminalScrollback(merged.terminalScrollback)
    merged.terminalFontFamily = normalizeTerminalFontFamilyKey(merged.terminalFontFamily)
    merged.sshKeepaliveInterval = clampSshKeepaliveInterval(merged.sshKeepaliveInterval)
    merged.loggingMode = normalizeLoggingMode(merged.loggingMode)
    if (!('logPath' in saved)) {
      const def = getDefaultLogPath()
      if (def) merged.logPath = def
    }
    if (!['auto', 'en', 'zh'].includes(merged.uiLanguage)) merged.uiLanguage = 'auto'
    if (!['dark', 'light', 'auto'].includes(merged.appTheme)) merged.appTheme = 'auto'
    merged.sidebarWidth = clampSidebarWidthPx(merged.sidebarWidth, typeof window !== 'undefined' ? window.innerWidth : 1200)
    return merged
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

/**
 * 保存设置项，将设置对象序列化为 JSON 存储到 localStorage 中
 * @param settings 要保存的设置项对象
 */
export function saveSettings(settings: AppSettings): void {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)) } catch {}
  syncUiLanguageToMain(settings?.uiLanguage)
}

/**
 * 导设置项为 JSON 文件，文件名包含当前日期
 * @param settings 要导出的设置对象
 * @param t 翻译函数
 */
export async function exportSettings(settings: AppSettings, t: TranslateFn): Promise<void> {
  await downloadJsonExport('settings', settings, t)
}
