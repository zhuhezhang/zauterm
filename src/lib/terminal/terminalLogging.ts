import type { Terminal } from '@xterm/xterm'
import type { RefObject } from 'react'
import { safeFileToken } from '../../lib/safeFileName'
import { fileTimestamp } from '../util/fileTimestamp'
import { resolveLoggingDirectory } from '../../store/settingsStore'
import { normalizeLoggingMode } from '../settings/normalize'
import type { ActiveSession } from '../../types/session'
import { sessionEndpoint } from '../../types/session'
import type { AppSettings } from '../../types/settings'
import type { SessionLogHandle } from '../../types/session'

/** 
 * 导出当前终端缓冲为纯文本（用于复制/保存）
 * @param term 终端实例
 * @returns 终端缓冲为纯文本
 */
export function exportTerminalBuffer(term: Terminal | null): string {
  if (!term) return ''
  const buf = term.buffer.active
  const lines = []
  for (let i = 0; i < buf.length; i++) {
    const line = buf.getLine(i)
    if (!line) continue
    lines.push(line.translateToString(true).replace(/\u00a0/g, ' '))
  }
  return lines.join('\n').trimEnd()
}

/**
 * 去掉已完整的 ANSI/OSC 等转义序列（CSI 如 [33m、[42D；OSC 至 BEL 或 ST 等）
 * @param s 文本
 * @returns 去掉已完整的 ANSI/OSC 等转义序列后的文本
 */
function stripCompleteAnsiEscapes(s: string): string {
  if (!s) return ''
  return s
    .replace(/\x1b\[[\x30-\x3f]*[\x20-\x2f]*[\x40-\x7e]/g, '')
    .replace(/\u009b[\x30-\x3f]*[\x20-\x2f]*[\x40-\x7e]/g, '')
    .replace(/\x1b\][^\x07]*\x07/g, '')
    .replace(/\x1b\][^\x1b]*\x1b\\/g, '')
    .replace(/\x1b[\x20-\x2f][\x40-\x7e]/g, '')
    .replace(/\x1b[78]/g, '')
}

/**
 * 从串尾拆出可能未闭合的转义前缀，避免分包时把 \x1b 与 [33m 拆开误当成可见字符
 * @param s 文本
 * @returns 从串尾拆出可能未闭合的转义前缀后的文本
 */
function peelIncompleteAnsiSuffix(s: string): { body: string; carry: string } {
  if (!s) return { body: '', carry: '' }
  let m: RegExpMatchArray | null
  if ((m = s.match(/\x1b\](?:[^\x07\x1b]|\x1b(?!\\))*$/))) {
    return { body: s.slice(0, -m[0].length), carry: m[0] }
  }
  if ((m = s.match(/\x1b\[[\x30-\x3f\x20-\x2f]*$/))) {
    return { body: s.slice(0, -m[0].length), carry: m[0] }
  }
  if (s.endsWith('\x1b')) return { body: s.slice(0, -1), carry: '\x1b' }
  if (s.endsWith('\u009b')) return { body: s.slice(0, -1), carry: '\u009b' }
  return { body: s, carry: '' }
}

/**
 * 去掉其余 C0 控制符（保留 \t \n \r）
 * @param s 文本
 * @returns 去掉其余 C0 控制符（保留 \t \n \r）后的文本
 */
function stripOtherC0Controls(s: string): string {
  return s.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '')
}

/**
 * 将一段终端输出转为适合写入 .log 的纯文本（可见字符 + 换行制表）
 * @param carry 转义前缀
 * @param chunk 终端输出
 * @returns 将一段终端输出转为适合写入 .log 的纯文本（可见字符 + 换行制表）后的文本
 */
function stripAnsiForLogChunk(carry: string, chunk: string): { text: string; carry: string } {
  const raw = carry + chunk
  const { body, carry: nextCarry } = peelIncompleteAnsiSuffix(raw)
  const text = stripOtherC0Controls(stripCompleteAnsiEscapes(body))
  return { text, carry: nextCarry }
}

/**
 * 设置会话日志：buffer = xterm 缓冲快照整文件覆盖；stream = 下行流去 ANSI 后追加。
 * @param session 会话对象
 * @param settings 设置
 * @param logFileRef 日志文件引用
 * @param logFileStemStateRef 日志文件名状态引用
 * @param _settingsRef 预留与调用方签名一致（本函数内以创建时的 logKind 为准）
 */
export function setupLogging(
  session: ActiveSession,
  settings: AppSettings,
  logFileRef: RefObject<SessionLogHandle | null>,
  logFileStemStateRef: RefObject<{ sessionId: string | null; stem: string | null }>,
  _settingsRef: RefObject<AppSettings>,
): void {
  if (normalizeLoggingMode(settings?.loggingMode) === 'none') return
  const logDir = resolveLoggingDirectory(settings)
  if (!logDir) return

  const logKind = normalizeLoggingMode(settings.loggingMode)  // 本控制器创建时的写入方式（关闭日志时 settings 可能已变为 none，收尾刷盘仍按此方式执行）
  const stemState = logFileStemStateRef.current
  if (stemState.sessionId !== session.id) {  // 新会话：重置文件名 stem
    stemState.sessionId = session.id
    stemState.stem = null
  }

  /** 同一标签页内复用的日志主文件名（不含 .log） */
  let logFileName = stemState.stem
  if (!logFileName) {  // 首次连接：时间戳_会话名
    const sessionName = safeFileToken(session.label || sessionEndpoint(session) || session.id || 'session')
    logFileName = `${fileTimestamp()}_${sessionName}`
    stemState.stem = logFileName
  }

  // --- stream（追加）
  let pending = ''
  let ansiCarry = ''
  let streamTimer: number | null = null
  /** 刷新待处理流数据 */
  const flushPendingStream = () => {
    streamTimer = null
    if (!pending) return
    const chunk = pending
    pending = ''
    window.zterm?.log?.append?.(logDir, logFileName, chunk)
  }

  /** 将数据追加到日志文件中 */
  const enqueue = (chunk: string) => {
    if (logKind !== 'stream') return
    if (chunk === '' || chunk == null) return
    if (typeof chunk !== 'string') return
    if (!window.zterm?.log?.append) return
    const { text, carry } = stripAnsiForLogChunk(ansiCarry, chunk)
    ansiCarry = carry
    if (!text) return
    pending += text
    if (streamTimer != null) return
    streamTimer = window.setTimeout(flushPendingStream, 80)
  }

  // --- buffer（整文件覆盖）
  /** xterm 终端实例 */
  let terminal: Terminal | null = null
  /** 定时器引用，用于延迟执行快照 */
  let snapshotTimer: number | null = null
  /** 快照延迟时间 */
  const SNAPSHOT_DEBOUNCE_MS = 80
  /** 刷新快照 */
  const flushSnapshot = () => {
    if (!window.zterm?.log?.write) return
    if (!terminal) return
    try {
      window.zterm.log.write(logDir, logFileName, exportTerminalBuffer(terminal))
    } catch {}
  }

  /** 计划快照 */
  const scheduleSnapshot = () => {
    if (logKind !== 'buffer') return
    if (!window.zterm?.log?.write) return
    if (!terminal) return
    if (snapshotTimer != null) {
      window.clearTimeout(snapshotTimer)
      snapshotTimer = null
    }
    snapshotTimer = window.setTimeout(() => {
      snapshotTimer = null
      flushSnapshot()
    }, SNAPSHOT_DEBOUNCE_MS)
  }

  /** 立即刷盘 */
  const flushNow = () => {
    if (snapshotTimer != null) {
      window.clearTimeout(snapshotTimer)
      snapshotTimer = null
    }
    if (streamTimer != null) {
      window.clearTimeout(streamTimer)
      streamTimer = null
    }
    if (logKind === 'buffer') {
      pending = ''
      ansiCarry = ''
      flushSnapshot()
    } else {
      if (ansiCarry) {
        const { text } = stripAnsiForLogChunk(ansiCarry, '')
        ansiCarry = ''
        if (text) pending += text
      }
      flushPendingStream()
    }
  }

  const setTerminal = (t: Terminal | null) => {
    terminal = t
  }

  logFileRef.current = { setTerminal, scheduleSnapshot, enqueue, flushNow }
}
