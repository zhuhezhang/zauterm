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
 * 从 normal buffer 导出已提交纯文本（默认不含光标行，避免进度条中间态）
 * @param term 终端实例
 * @param includeCursorLine 是否包含光标所在行（会话结束 flush 时为 true）
 */
export function exportCommittedNormalBuffer(term: Terminal, includeCursorLine: boolean): string {
  const buf = term.buffer.normal
  const endExclusive = includeCursorLine
    ? Math.min(buf.length, buf.baseY + buf.cursorY + 1)
    : Math.min(buf.length, buf.baseY + buf.cursorY)
  if (endExclusive <= 0) return ''
  const lines: string[] = []
  for (let i = 0; i < endExclusive; i++) {
    const line = buf.getLine(i)
    if (!line) continue
    lines.push(line.translateToString(true).replace(/\u00a0/g, ' '))
  }
  return lines.join('\n').trimEnd()
}

/**
 * 相对上次已提交文本计算应追加的增量（处理前缀增长与 scrollback 顶行淘汰）
 * @param prev 上次已提交全文（对应当时 buffer 已提交区）
 * @param next 当前已提交全文
 * @returns delta 写入磁盘的增量；committed 下次对比用的已提交全文（恒为 next）
 */
export function diffCommittedLogDelta(prev: string, next: string): { delta: string; committed: string } {
  if (next === prev) return { delta: '', committed: prev }
  if (!prev) return { delta: next, committed: next }
  if (next.startsWith(prev)) {
    return { delta: next.slice(prev.length), committed: next }
  }

  const prevLines = prev.length ? prev.split('\n') : []
  const nextLines = next.length ? next.split('\n') : []
  const maxOverlap = Math.min(prevLines.length, nextLines.length)
  let overlap = 0
  for (let k = maxOverlap; k >= 1; k--) {
    let ok = true
    for (let i = 0; i < k; i++) {
      if (prevLines[prevLines.length - k + i] !== nextLines[i]) {
        ok = false
        break
      }
    }
    if (ok) {
      overlap = k
      break
    }
  }

  const tail = nextLines.slice(overlap).join('\n')
  if (!tail) return { delta: '', committed: next }
  if (overlap === 0) {
    // 清屏/大范围重绘：保留磁盘历史，用空行与新区隔开
    return { delta: prev ? `\n\n${tail}` : tail, committed: next }
  }
  return { delta: `\n${tail}`, committed: next }
}

/**
 * 设置会话日志：从 xterm normal buffer 已提交行做增量 append（与屏幕一致、磁盘友好）
 * @param session 会话对象
 * @param settings 设置
 * @param logFileRef 日志文件引用
 * @param logFileStemStateRef 日志文件名状态引用
 * @param _settingsRef 预留与调用方签名一致
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

  const stemState = logFileStemStateRef.current
  if (stemState.sessionId !== session.id) {  // 新会话：重置文件名 stem
    stemState.sessionId = session.id
    stemState.stem = null
  }

  /** 同一标签页内复用已有日志文件时，首次只对齐 buffer 水位，避免重连/重建控制器重复追加整屏 */
  const continuingFile = Boolean(stemState.stem)

  /** 同一标签页内复用的日志主文件名（不含 .log） */
  let logFileName = stemState.stem
  if (!logFileName) {  // 首次连接：时间戳_会话名
    const sessionName = safeFileToken(session.label || sessionEndpoint(session) || session.id || 'session')
    logFileName = `${fileTimestamp()}_${sessionName}`
    stemState.stem = logFileName
  }

  let terminal: Terminal | null = null
  let lastCommitted = ''
  /** 续写同一文件时，第一次 commit 只同步水位不写盘 */
  let seeded = !continuingFile
  let commitTimer: number | null = null
  const COMMIT_DEBOUNCE_MS = 80

  const flushCommit = (includeCursorLine: boolean) => {
    if (!window.zauterm?.log?.append) return
    if (!terminal) return
    // vim/htop 等 alternate screen：不记入会话日志
    if (terminal.buffer.active !== terminal.buffer.normal) return
    try {
      const current = exportCommittedNormalBuffer(terminal, includeCursorLine)
      if (!seeded) {
        lastCommitted = current
        seeded = true
        return
      }
      const { delta, committed } = diffCommittedLogDelta(lastCommitted, current)
      lastCommitted = committed
      if (!delta) return
      window.zauterm.log.append(logDir, logFileName, delta)
    } catch {}
  }

  const scheduleSnapshot = () => {
    if (!window.zauterm?.log?.append) return
    if (!terminal) return
    if (commitTimer != null) {
      window.clearTimeout(commitTimer)
      commitTimer = null
    }
    commitTimer = window.setTimeout(() => {
      commitTimer = null
      flushCommit(false)
    }, COMMIT_DEBOUNCE_MS)
  }

  const flushNow = () => {
    if (commitTimer != null) {
      window.clearTimeout(commitTimer)
      commitTimer = null
    }
    flushCommit(true)
  }

  const setTerminal = (t: Terminal | null) => {
    terminal = t
  }

  logFileRef.current = { setTerminal, scheduleSnapshot, flushNow }
}
