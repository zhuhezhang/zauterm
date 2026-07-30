/**
 * Tauri macOS（WKWebView）不实现 JS 的 confirm/alert：对话框不出现，
 * confirm 往往直接返回 true/false。统一走 tauri-plugin-dialog。
 */
import { confirm as tauriConfirm, message as tauriMessage } from '@tauri-apps/plugin-dialog'

const DEFAULT_TITLE = 'ZTerm'

/** 确认对话框（Ok / Cancel），等价于 window.confirm */
export async function uiConfirm(text: string, title = DEFAULT_TITLE): Promise<boolean> {
  try {
    return await tauriConfirm(text, { title, kind: 'warning' })
  } catch {
    return window.confirm(text)
  }
}

/** 提示对话框（Ok），等价于 window.alert */
export async function uiAlert(text: string, title = DEFAULT_TITLE): Promise<void> {
  try {
    await tauriMessage(text, { title })
  } catch {
    window.alert(text)
  }
}
