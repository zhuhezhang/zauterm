/**
 * Tauri WebView 的 navigator.clipboard 常不可用（权限/非安全上下文），
 * 统一走 tauri-plugin-clipboard-manager；失败时再回退到浏览器 API。
 */
import {
  readText as tauriReadText,
  writeText as tauriWriteText,
} from '@tauri-apps/plugin-clipboard-manager'

/**
 * 写入系统剪贴板文本
 * @param text 要写入的文本
 */
export async function writeClipboardText(text: string): Promise<void> {
  try {
    await tauriWriteText(text)
  } catch {
    await navigator.clipboard?.writeText(text)
  }
}

/**
 * 读取系统剪贴板文本
 * @returns 剪贴板文本；失败时回退 navigator.clipboard，仍失败则返回空串
 */
export async function readClipboardText(): Promise<string> {
  try {
    return await tauriReadText()
  } catch {
    try {
      return (await navigator.clipboard?.readText()) ?? ''
    } catch {
      return ''
    }
  }
}
