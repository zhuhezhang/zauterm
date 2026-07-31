/**
 * i18n 按点路径查表；渲染进程经 translateRender / useI18n 使用。
 * IPC 已知错误由 formatIpcResponseError 翻译 content.error。
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
