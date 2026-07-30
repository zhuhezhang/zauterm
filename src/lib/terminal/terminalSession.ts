import type { RefObject } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { fitTerminal, proposeTerminalDimensions } from './fitTerminal'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { decodeIncomingTerminalWire } from '../terminalEncodingService'
import { normalizeTerminalEncoding } from '../../../shared/terminalEncoding'
import { clampTerminalScrollback } from '../settings/normalize'
import { resolveTerminalFontFamily } from '../../../shared/terminalFonts'
import { translateRender } from '../../i18n/translateRender'
import { resolveEffectiveUiLanguage } from '../resolveUiLanguage'
import { assertIpcSuccess } from '../ipc/ipcError'
import { getZterm } from '@/lib/ipc/getZterm'
import { formatThrownIpcError } from '@/lib/ipc/formatIpcError'
import { getXtermTheme } from '../../theme/appTheme'
import { pickSerialConnectConfig, pickSshConnectConfig, pickTelnetConnectConfig } from '../session/connectPayload'
import { applyHighlightRules, nextLineBreakEndIndex } from './terminalHighlight'
import { attachMissingControlKeys } from './missingControlKeys'
import type { ActiveSession, SessionType } from '../../types/session'
import type { AppSettings } from '../../types/settings'
import type { SessionLogHandle } from '../../types/session'

/**
 * 写入一行终端内容并按当前日志模式记入会话日志
 * @param term xterm 终端实例
 * @param logRef 日志引用，包含 scheduleSnapshot 和 enqueue 方法
 * @param lineForWriteln 传给 term.writeln 的字符串（不含结尾换行），用于写入终端
 */
export function writelnWithLog(
  term: Terminal,
  logRef: RefObject<SessionLogHandle | null>,
  lineForWriteln: string,
): void {
  term.writeln(lineForWriteln)
  logRef.current?.scheduleSnapshot?.()
  logRef.current?.enqueue?.(lineForWriteln + '\r\n')
}

/**
 * 规范化用户输入，兼容部分设备对退格键的不同解释
 * - 一些设备将 DEL(0x7f) 解释为“向前删除”，会导致必须先左移光标才能删除字符
 * - 对 Telnet/Serial 会话把 DEL 转为 BS(0x08)，更符合设备控制台习惯
 * @param type 会话类型
 * @param data xterm 原始输入数据
 * @param session 当前会话（含 per-session backspaceMode）
 * @returns 规范化后的数据
 */
function normalizeInputData(type: SessionType | string, data: string, session: ActiveSession): string {
  const mode = String(session?.backspaceMode || 'auto').toLowerCase()
  if (mode === 'del') return data.replace(/\x08/g, '\x7f')
  if (mode === 'bs') return data.replace(/\x7f/g, '\x08')
  // Auto：SSH 默认保留 DEL；Telnet/Serial 默认转为 BS，兼容更多设备
  if (type === 'telnet' || type === 'serial') return data.replace(/\x7f/g, '\x08')
  return data
}

/**
 * 创建并配置 xterm 终端实例
 * @param themeMode 主题名称
 * @param scrollback 滚动缓冲行数（由设置 clamp）
 * @returns 配置好的 Terminal 实例
 */
export function createTerminal(themeMode: 'dark' | 'light', scrollback: number, fontFamily: string): Terminal {
  return new Terminal({
    fontFamily,
    fontSize: 14,
    lineHeight: 1.4,
    cursorBlink: true,
    cursorStyle: 'bar',
    allowTransparency: true,
    allowProposedApi: true, // SearchAddon 高亮匹配依赖 registerDecoration（proposed API）
    scrollback, // 由设置 terminalScrollback 控制，挂载后仍可改 options.scrollback
    windowsMode: false,
    theme: getXtermTheme(themeMode),
  })
}

/**
 * 应用终端交互设置：根据用户设置启用选中复制和右键粘贴功能
 * @param term xterm 终端实例
 * @param settingsRef 设置对象的引用，包含用户偏好设置
 * @returns 清理函数
 */
export function applyTerminalSettings(
  term: Terminal,
  settingsRef: RefObject<AppSettings>,
): () => void {
  const selDispose = term.onSelectionChange(() => {  // 监听选中时复制：通过 settingsRef 实时读取，保证设置变化后立即生效
    const interact = settingsRef.current?.terminalInteract ?? true  // ?? 是空值合并运算符，表示如果 terminalInteract 不为 null 或 undefined 则使用它，否则默认 true
    if (!interact) return
    const sel = term.getSelection()
    if (sel && sel.length > 0) {
      navigator.clipboard?.writeText(sel).catch(() => {})
    }
  })

  let ctxTimer: number | null = null
  let ctxEl: HTMLElement | null = null
  let ctxHandler: ((e: MouseEvent) => void) | null = null

  const addCtx = () => {  // 右键粘贴：等 term.element 挂载后注册
    if (!term.element) {
      ctxTimer = window.setTimeout(addCtx, 50)  // addCtx 函数递归检查 term.element 是否存在（xterm.js 挂载后才可用），不存在则 50ms 后重试
      return
    }
    ctxEl = term.element
    ctxHandler = async (e: MouseEvent) => {  // 在 term.element 上监听 contextmenu（右键菜单）事件
      const interact = settingsRef.current?.terminalInteract ?? true
      if (!interact) return
      e.preventDefault()
      try {
        const t = await navigator.clipboard.readText()
        term.paste(t)
      } catch {}
    }
    ctxEl.addEventListener('contextmenu', ctxHandler)
  }
  addCtx()

  return () => {
    selDispose.dispose()
    if (ctxTimer != null) window.clearTimeout(ctxTimer)
    if (ctxEl && ctxHandler) ctxEl.removeEventListener('contextmenu', ctxHandler)
  }
}

/**
 * 断开主进程侧会话 transport（SSH/Telnet/Serial，及可选 SFTP）。
 * 标签页关闭或连接中途取消时调用；重复 disconnect 安全
 * @param session 会话对象，包含会话 ID、类型和可选 SFTP 配置
 * @param options 可选参数，包含是否包含 SFTP 配置
 */
export function teardownSessionTransport(
  session: { id: string; type: string; enableSftp?: boolean },
  options?: { includeSftp?: boolean },
): void {
  const zterm = getZterm()
  const { id, type } = session
  const includeSftp = options?.includeSftp ?? !!session.enableSftp
  try {
    if (type === 'ssh') {
      if (includeSftp) void zterm.sftp.disconnect(`${id}-sftp`)
      void zterm.ssh.disconnect(id)
    } else if (type === 'telnet') {
      void zterm.telnet.disconnect(id)
    } else if (type === 'serial') {
      void zterm.serial.disconnect(id)
    }
  } catch {
    /* 主进程会话可能尚未建立或已断开 */
  }
}

/**
 * 连接已取消：断开可能已建立的 transport 并跳过后续 UI/监听注册
 * @param session 会话对象，包含会话 ID、类型和可选 SFTP 配置
 * @param isCancelled 取消函数，组件卸载时返回 true，连接过程中定期调用以判断是否应放弃后续操作
 * @param options 可选参数，包含是否包含 SFTP 配置
 * @returns 是否已取消，如果已取消则断开 transport 并返回 true
 */
function abortIfCancelled(
  session: ActiveSession,
  isCancelled: () => boolean,
  options?: { includeSftp?: boolean },
): boolean {
  if (!isCancelled()) return false
  teardownSessionTransport(session, options)
  return true
}

/**
 * 连接会话：根据会话类型（SSH/Telnet/Serial）调用对应的连接函数，设置数据接收和连接关闭的处理函数，并将清理函数添加到 cleanupRef 以便组件卸载时调用
 * @param term xterm 终端实例
 * @param session 会话对象，包含连接信息和状态
 * @param onUpdate 会话状态更新回调函数
 * @param cleanupRef 清理函数引用，用于存储连接相关的清理函数
 * @param disconnectedRef 断连状态引用，用于标记当前连接是否已断开
 * @param isCancelled 可选的取消函数，组件卸载时返回 true，连接过程中定期调用以判断是否应放弃后续操作
 * @param logFileRef 会话日志：buffer / stream 由设置决定，flushNow 立即刷盘
 * @param settingsRef 设置引用，用于读取实时终端行为设置
 */
export async function connectSession(
  term: Terminal,
  session: ActiveSession,
  sessionRef: RefObject<ActiveSession>,
  onUpdate: (updates: Partial<ActiveSession>) => void,
  cleanupRef: RefObject<Array<() => void>>,
  disconnectedRef: RefObject<boolean>,
  isCancelled: () => boolean,
  logFileRef: RefObject<SessionLogHandle | null>,
  settingsRef: RefObject<AppSettings>,
): Promise<void> {
  const { id, type } = session
  const terminalEncoding = normalizeTerminalEncoding(session?.encoding)
  const L = () => resolveEffectiveUiLanguage(settingsRef.current?.uiLanguage)
  const writeInfo = (m: string) => writelnWithLog(term, logFileRef, `\r\x1b[33m${m}\x1b[0m`)
  const writeError = (m: string) => writelnWithLog(term, logFileRef, `\r\x1b[31m${m}\x1b[0m`)
  const writeSuccess = (m: string) => writelnWithLog(term, logFileRef, `\r\x1b[32m${m}\x1b[0m`)
  const terminalErr = (e: unknown) => formatThrownIpcError((p, params) => translateRender(L(), p, params), e)  // errorKnown:false 直出原文; true 则按 error 路径走 i18n

  /** 提示按 R 重连并标记为可重连状态 */
  const showReconnectHint = () => {
    writeInfo(`\x1b[2m${translateRender(L(), 'terminal.pressR')}\x1b[0m`)
    disconnectedRef.current = true
  }

  /**
   * 连接断开处理函数：在终端显示断开消息，提示用户按 R 重连，更新会话状态为断开，并设置断连标记
   * @param msgKey terminal.* 文案键
   */
  const onDisconnect = (msgKey: string) => {
    writeInfo(`\r\n${translateRender(L(), msgKey)}`)
    showReconnectHint()
    onUpdate({ status: 'disconnected', sftpReady: false })
  }

  // 串口下行小块聚合：高亮规则需在足够长的文本上匹配，UART 常逐字节到达
  let serialHighlightBuf = ''
  let serialHighlightIdleTimer: number | null = null
  /** 串口高亮缓冲区空闲时刷新：避免长时间无数据时高亮规则无法匹配 */
  const flushSerialHighlightIdle = () => {
    serialHighlightIdleTimer = null
    if (!serialHighlightBuf) return
    const chunk = serialHighlightBuf
    serialHighlightBuf = ''
    const highlighted = applyHighlightRules(chunk, settingsRef.current)
    term.write(highlighted)
    logFileRef.current?.scheduleSnapshot?.()
    logFileRef.current?.enqueue?.(highlighted)
  }
  /** 计划串口高亮缓冲区空闲时刷新：避免长时间无数据时高亮规则无法匹配 */
  const scheduleSerialHighlightFlush = () => {
    if (serialHighlightIdleTimer != null) clearTimeout(serialHighlightIdleTimer)
    serialHighlightIdleTimer = window.setTimeout(flushSerialHighlightIdle, 32)
  }

  /**
   * 数据接收处理函数：将接收到的二进制数据转换为 UTF-8 字符串，写入终端并记录日志
   * @param data 接收到的二进制数据字符串
   */
  const recv = (data: string) => {
    const decoded = decodeIncomingTerminalWire(data, terminalEncoding)
    if (type !== 'serial') {
      const highlighted = applyHighlightRules(decoded, settingsRef.current)
      term.write(highlighted)
      logFileRef.current?.scheduleSnapshot?.()
      logFileRef.current?.enqueue?.(highlighted)
      return
    }
    serialHighlightBuf += decoded
    let end
    while ((end = nextLineBreakEndIndex(serialHighlightBuf)) >= 0) {
      const line = serialHighlightBuf.slice(0, end + 1)
      serialHighlightBuf = serialHighlightBuf.slice(end + 1)
      const highlighted = applyHighlightRules(line, settingsRef.current)
      term.write(highlighted)
      logFileRef.current?.scheduleSnapshot?.()
      logFileRef.current?.enqueue?.(highlighted)
    }
    if (serialHighlightBuf.length > 8192) {  // 防止无换行长流撑爆缓冲
      const overflow = serialHighlightBuf
      serialHighlightBuf = ''
      const highlighted = applyHighlightRules(overflow, settingsRef.current)
      term.write(highlighted)
      logFileRef.current?.scheduleSnapshot?.()
      logFileRef.current?.enqueue?.(highlighted)
    }
    if (serialHighlightBuf.length === 0) {
      if (serialHighlightIdleTimer != null) {
        clearTimeout(serialHighlightIdleTimer)
        serialHighlightIdleTimer = null
      }
    } else {
      scheduleSerialHighlightFlush()
    }
  }

  if (session.type === 'ssh') {
    writeInfo(translateRender(L(), 'terminal.sshConnecting', { host: session.host ?? '', port: session.port ?? 22 }))
    try {
      const zterm = getZterm()
      const connectPayload = pickSshConnectConfig(session, settingsRef.current)
      const res = await zterm.ssh.connect(id, connectPayload)
      if (abortIfCancelled(session, isCancelled, { includeSftp: false })) return
      assertIpcSuccess(res)
      writeSuccess(translateRender(L(), 'terminal.connected'))
      onUpdate({ status: 'connected' })
      const dim = proposeTerminalDimensions(term) || { cols: 80, rows: 24 }
      zterm.ssh.resize(id, dim.cols, dim.rows)

      const r1 = zterm.ssh.onData(id, recv)
      const r2 = zterm.ssh.onClose(id, () => onDisconnect('terminal.closed'))
      const d1 = term.onData((data) => {
        zterm.ssh.sendData(id, normalizeInputData(type, data, sessionRef.current), terminalEncoding)
      })
      const d2 = term.onResize(({ cols, rows }) => zterm.ssh.resize(id, cols, rows))
      cleanupRef.current.push(r1, r2, () => d1.dispose(), () => d2.dispose(), () => zterm.ssh.disconnect(id))

      // SFTP 与 SSH 并行：失败只提示，不阻断 shell
      if (session.enableSftp) {
        try {
          const sftpPayload = pickSshConnectConfig(session, settingsRef.current)
          const sr = await zterm.sftp.connect(id + '-sftp', sftpPayload)
          if (abortIfCancelled(session, isCancelled, { includeSftp: true })) return
          if (sr.success) {
            onUpdate({ status: 'connected', sftpReady: true })
            cleanupRef.current.push(() => zterm.sftp.disconnect(id + '-sftp'))
          } else {
            assertIpcSuccess(sr)
          }
        } catch (e) {
          writeError(terminalErr(e))
          zterm.ssh.sendData(id, '\n', terminalEncoding)  // 让用户看到错误后仍可操作 shell
          onUpdate({ sftpReady: false })
        }
      }
    } catch (e) {
      if (isCancelled?.()) return
      writeError(terminalErr(e))
      showReconnectHint()
      onUpdate({ status: 'error' })
    } finally {
      try {
        await getZterm().others.clearSessionHostKeyCache()
      } catch { /* 清理临时指纹缓存，失败不影响连接结果 */ }
    }
  } else if (session.type === 'telnet') {
    writeInfo(translateRender(L(), 'terminal.telnetConnecting', { host: session.host ?? '', port: session.port ?? 23 }))
    try {
      const zterm = getZterm()
      const res = await zterm.telnet.connect(id, pickTelnetConnectConfig(session))
      if (abortIfCancelled(session, isCancelled)) return
      assertIpcSuccess(res)
      writeSuccess(translateRender(L(), 'terminal.connected'))
      onUpdate({ status: 'connected' })
      const r1 = zterm.telnet.onData(id, recv)
      const r2 = zterm.telnet.onClose(id, () => onDisconnect('terminal.closed'))
      const d1 = term.onData((data) => {
        zterm.telnet.sendData(id, normalizeInputData(type, data, sessionRef.current), terminalEncoding)
      })
      cleanupRef.current.push(r1, r2, () => d1.dispose(), () => zterm.telnet.disconnect(id))
    } catch (e) {
      if (isCancelled?.()) return
      writeError(terminalErr(e))
      showReconnectHint()
      onUpdate({ status: 'error' })
    }
  } else if (session.type === 'serial') {
    writeInfo(translateRender(L(), 'terminal.serialOpening', { path: session.path ?? '', baud: session.baudRate ?? 9600 }))
    try {
      const zterm = getZterm()
      const res = await zterm.serial.connect(id, pickSerialConnectConfig(session))
      if (abortIfCancelled(session, isCancelled)) return
      assertIpcSuccess(res)
      writeSuccess(translateRender(L(), 'terminal.serialOpened'))
      onUpdate({ status: 'connected' })
      const r1 = zterm.serial.onData(id, recv)
      const r2 = zterm.serial.onClose(id, () => onDisconnect('terminal.portClosed'))
      const d1 = term.onData((data) => {
        zterm.serial.sendData(id, normalizeInputData(type, data, sessionRef.current), terminalEncoding)
      })
      cleanupRef.current.push(() => {  // 断开前刷掉串口高亮缓冲
        if (serialHighlightIdleTimer != null) {
          clearTimeout(serialHighlightIdleTimer)
          serialHighlightIdleTimer = null
        }
        if (serialHighlightBuf) {
          const highlighted = applyHighlightRules(serialHighlightBuf, settingsRef.current)
          term.write(highlighted)
          logFileRef.current?.scheduleSnapshot?.()
          logFileRef.current?.enqueue?.(highlighted)
          serialHighlightBuf = ''
        }
      }, r1, r2, () => d1.dispose(), () => zterm.serial.disconnect(id))
    } catch (e) {
      if (isCancelled?.()) return
      writeError(terminalErr(e))
      showReconnectHint()
      onUpdate({ status: 'error' })
    }
  }
}

/**
 * 在容器内挂载 xterm（FitAddon、WebLinks、交互设置），返回实例与清理函数
 * @param container 挂载容器 DOM 元素
 * @param appThemeEffective 主题模式，用于设置 xterm 主题
 * @param settingsRef 设置引用，用于读取终端行为设置（如 scrollback）
 * @returns 包含 Terminal 实例、FitAddon 实例和清理函数的对象
 */
export function mountTerminal(
  container: HTMLDivElement,
  appThemeEffective: 'dark' | 'light',
  settingsRef: RefObject<AppSettings>,
): { term: Terminal; fitAddon: FitAddon; disposeSettings: () => void } {
  const term = createTerminal(
    appThemeEffective,
    clampTerminalScrollback(settingsRef.current?.terminalScrollback),
    resolveTerminalFontFamily(settingsRef.current?.terminalFontFamily),
  )
  const fitAddon = new FitAddon()
  term.loadAddon(fitAddon)
  term.loadAddon(new WebLinksAddon())  // WebLinksAddon 负责将终端中的 URL 自动识别为可点击链接
  term.open(container)  // 将 xterm 实例挂载到 container 指向的 DOM 元素上
  attachMissingControlKeys(term)  // Ctrl+Shift+6（Ctrl+^）→ RS，xterm 5.5 默认不发送
  fitTerminal(fitAddon)  // 初始调整终端尺寸以适应容器大小
  const disposeSettings = applyTerminalSettings(term, settingsRef)
  return { term, fitAddon, disposeSettings }
}
