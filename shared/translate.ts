/**
 * i18n 约定:
 * - 主进程 IPC: { success, content:{ error?, errorParams? }, errorKnown? }; errorKnown:true 时由 formatIpcResponseError 翻译 content.error
 * - 主进程 translateMain: 仅系统对话框、串口终端直写等主进程本地 UI
 * - 渲染进程 (translateRender / useI18n): 界面文案与导入校验等
 * - 终端连接错误: formatThrownIpcError (errorKnown:false 原文, true 则按 error 路径 i18n)
 * - uiLanguage 的 auto 解析在 src/lib/resolveUiLanguage.js, 主进程仅收 zh/en
 */

type UiLang = 'zh' | 'en'
type MessagesByLang = { zh: object; en: object }

/**
 * 按点路径查表并替换 {name} 占位符
 * @param lang 语言
 * @param messagesByLang 各语言嵌套文案对象
 * @param path 点路径, 如 sftp.pathErrors.localDirDenied
 * @param params 参数（如{name: '张三'}）
 * @returns 翻译后的文案
 */
export function translate(
  lang: string,
  messagesByLang: MessagesByLang,
  path: string,
  params: Record<string, string | number> = {},
): string {
  const L: UiLang = lang === 'en' ? 'en' : 'zh'
  const parts = path.split('.')
  let cur: unknown = messagesByLang[L]
  for (const p of parts) {
    cur = (cur as Record<string, unknown>)?.[p] // 将 cur 转换为 Record<string, unknown> 类型，并取 p 属性
  }
  if (typeof cur !== 'string') return path
  return cur.replace(/\{(\w+)\}/g, (_, k) => (params[k] != null ? String(params[k]) : `{${k}}`))
}
