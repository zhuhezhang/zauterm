/** 终端字体 preset key（持久化到 localStorage） */
export type TerminalFontFamilyKey =
  | 'cascadia'
  | 'jetbrains'
  | 'fira'
  | 'menlo'
  | 'consolas'
  | 'source-code-pro'
  | 'courier-new'

/** 终端字体 preset 定义 */
export const TERMINAL_FONT_FAMILY_OPTIONS = [
  { value: 'cascadia' as const, fontFamily: '"Cascadia Code", "Cascadia Mono", monospace' },
  { value: 'jetbrains' as const, fontFamily: '"JetBrains Mono", monospace' },
  { value: 'fira' as const, fontFamily: '"Fira Code", monospace' },
  { value: 'menlo' as const, fontFamily: 'Menlo, Monaco, monospace' },
  { value: 'consolas' as const, fontFamily: 'Consolas, "Courier New", monospace' },
  { value: 'source-code-pro' as const, fontFamily: '"Source Code Pro", monospace' },
  { value: 'courier-new' as const, fontFamily: '"Courier New", Courier, monospace' },
] as const

/** 默认终端字体 preset */
export const DEFAULT_TERMINAL_FONT_FAMILY: TerminalFontFamilyKey = 'cascadia'

/** 终端字体 preset key 对应的 xterm fontFamily 字符串 */
const FONT_FAMILY_BY_KEY: Record<TerminalFontFamilyKey, string> = Object.fromEntries(
  TERMINAL_FONT_FAMILY_OPTIONS.map((o) => [o.value, o.fontFamily]),
) as Record<TerminalFontFamilyKey, string>

/** 终端字体 preset key 集合 */
const TERMINAL_FONT_FAMILY_KEY_SET = new Set<string>(TERMINAL_FONT_FAMILY_OPTIONS.map((o) => o.value))

/**
 * 将持久化的 preset key 规范为合法枚举值
 * @param raw 导入或表单中的原始值
 * @param fallback 非法时回退
 * @returns 规范后的终端字体 preset key
 */
export function normalizeTerminalFontFamilyKey(
  raw: unknown,
  fallback: TerminalFontFamilyKey = DEFAULT_TERMINAL_FONT_FAMILY,
): TerminalFontFamilyKey {
  const v = String(raw ?? '').trim().toLowerCase()
  if (TERMINAL_FONT_FAMILY_KEY_SET.has(v)) return v as TerminalFontFamilyKey
  return fallback
}

/**
 * 将 preset key 解析为 xterm fontFamily 字符串
 * @param key 终端字体 preset key
 * @param fallback 非法 key 时回退的 preset
 * @returns xterm fontFamily 字符串
 */
export function resolveTerminalFontFamily(
  key: unknown,
  fallback: TerminalFontFamilyKey = DEFAULT_TERMINAL_FONT_FAMILY,
): string {
  const k = normalizeTerminalFontFamilyKey(key, fallback)
  return FONT_FAMILY_BY_KEY[k] ?? FONT_FAMILY_BY_KEY[fallback]
}
