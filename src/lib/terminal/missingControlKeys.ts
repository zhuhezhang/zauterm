import type { Terminal } from '@xterm/xterm'

/**
 * ZTerm 基于 xterm.js 5.5.0，在 Chromium/Electron 里没有把 Ctrl+Shift+6 映射成 RS，
 * 所以 Ctrl+Shift+6 按键被吞掉，远程端收不到任何数据。这里补齐 xterm 5.5 在 Chromium 内缺失的
 * Ctrl+^（Ctrl+Shift+6）→ RS(0x1e)，在 xterm 默认逻辑之前拦截 Ctrl+Shift+6，手动注入 \x1e。
 * @param term xterm 终端实例
 */
export function attachMissingControlKeys(term: Terminal): void {
  term.attachCustomKeyEventHandler((ev) => {
    if (
      ev.type === 'keydown' &&
      ev.ctrlKey &&
      ev.shiftKey &&
      (ev.code === 'Digit6' || ev.key === '^')
    ) {
      term.input('\x1e', true)
      return false
    }
    return true
  })
}
