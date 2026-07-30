import type { AppSettings, LoggingMode } from '../../types/settings'
import { isIpcFailure } from '../ipc/ipcResponse'
import {
  DEFAULT_SIDEBAR_WIDTH, TERMINAL_SCROLLBACK_DEFAULT, TERMINAL_SCROLLBACK_MIN, TERMINAL_SCROLLBACK_MAX,
  SSH_KEEPALIVE_INTERVAL_DEFAULT, SSH_KEEPALIVE_INTERVAL_MIN, SSH_KEEPALIVE_INTERVAL_MAX,
} from './defaults'

/**
 * 将侧边栏宽度限制在窗口可用范围内（与主界面分割条 min/max 一致）
 * @param width 侧边栏宽度
 * @param [innerWidth] 窗口可用宽度
 * @returns 限制后的侧边栏宽度
 */
export function clampSidebarWidthPx(
  width: unknown,
  innerWidth: number = typeof window !== 'undefined' ? window.innerWidth : 1200,
  fallback: number = DEFAULT_SIDEBAR_WIDTH,
) {
  const iw = Math.max(320, Math.floor(Number(innerWidth)) || 1200)
  const min = Math.max(80, Math.floor(iw * 0.10))
  const max = Math.floor(iw * 0.90)
  const w = Math.floor(Number(width))
  if (!Number.isFinite(w)) return fallback
  return Math.min(max, Math.max(min, w))
}

/**
 * 将用户输入规范为合法滚动行数；无法解析时用内置默认
 * @param raw 用户输入的滚动行数
 * @returns 规范后的滚动行数
 */
export function clampTerminalScrollback(
  raw: unknown,
  fallback: number = TERMINAL_SCROLLBACK_DEFAULT,
) {
  const n = Math.floor(Number(raw))
  if (!Number.isFinite(n)) return fallback
  if (n < TERMINAL_SCROLLBACK_MIN) return TERMINAL_SCROLLBACK_MIN
  if (n > TERMINAL_SCROLLBACK_MAX) return TERMINAL_SCROLLBACK_MAX
  return n
}

/**
 * SSH keepalive 间隔（秒）：0 表示关闭；非法值回退 fallback
 * @param raw 用户输入的间隔秒数
 * @param fallback 非法时回退的值
 * @returns 规范后的间隔秒数
 */
export function clampSshKeepaliveInterval(
  raw: unknown,
  fallback: number = SSH_KEEPALIVE_INTERVAL_DEFAULT,
) {
  const n = Math.floor(Number(raw))
  if (!Number.isFinite(n)) return fallback
  if (n < SSH_KEEPALIVE_INTERVAL_MIN) return SSH_KEEPALIVE_INTERVAL_MIN
  if (n > SSH_KEEPALIVE_INTERVAL_MAX) return SSH_KEEPALIVE_INTERVAL_MAX
  return n
}

/** 
 * 设置界面数字项：按字段选用对应 clamp（避免全部误用 terminalScrollback 上限）
 * @param key 字段键
 * @param raw 用户输入的值
 * @returns 规范后的值
 */
export function clampSettingsNumberField(key: keyof AppSettings, raw: unknown): number {
  if (key === 'terminalScrollback') return clampTerminalScrollback(raw)
  if (key === 'sshKeepaliveInterval') return clampSshKeepaliveInterval(raw)
  const n = Math.floor(Number(raw))
  return Number.isFinite(n) ? n : 0
}

/**
 * 会话日志：none = 关闭；buffer = 与 xterm 屏幕缓冲一致；stream = 下行原始流去 ANSI 后追加
 * @param m 用户输入的日志模式
 * @returns 规范后的日志模式
 */
export function normalizeLoggingMode(m: unknown): LoggingMode {
  const v = String(m ?? '').trim().toLowerCase()
  if (v === 'none') return 'none'
  if (v === 'stream') return 'stream'
  return 'buffer'
}

/**
 * 判断路径是否像绝对路径（与设置界面选择目录后的校验条件一致）
 * @param p 路径
 * @returns 是否像绝对路径
 */
export function isLikelyAbsoluteLogPath(p: unknown) {
  const s = String(p ?? '').trim()
  if (!s) return false
  return s.startsWith('/') || s.startsWith('\\') || /^[a-zA-Z]:[\\/]/.test(s)
}

/**
 * 导入设置时规范 logPath：非字符串用 fallback；空白为 ''；绝对路径校验失败则 fallback
 * @param raw 导入的 logPath
 * @param fallback 非法时回退路径（通常为当前设置）
 * @returns 规范后的 logPath
 */
export async function normalizeImportedLogPath(raw: unknown, fallback: string = '') {
  const fb = typeof fallback === 'string' ? fallback : ''
  if (typeof raw !== 'string') return fb
  const p = raw.trim()
  if (!p) return ''
  try {
    if (typeof window !== 'undefined' && window.zterm?.paths?.validateLogDirectory && isLikelyAbsoluteLogPath(p)) {
      const vr = await window.zterm.paths.validateLogDirectory(p)
      if (isIpcFailure(vr)) return fb
    }
    return p
  } catch {
    return fb
  }
}
