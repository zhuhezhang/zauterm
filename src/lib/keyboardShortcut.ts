/**
 * 终端内容搜索快捷键展示文案（macOS ⌘⇧F，Windows/Linux Ctrl+Shift+F）
 * @returns 终端内容搜索快捷键展示文案
 */
export function terminalSearchShortcutLabel(): string {
  const mac = navigator.userAgent.includes('Mac OS X') &&
    !navigator.userAgent.includes('Windows') &&
    !navigator.userAgent.includes('Linux')
  return mac ? '⌘⇧F' : 'Ctrl+Shift+F'
}
