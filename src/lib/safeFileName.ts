import { INVALID_LABEL_CHARS } from '../../shared/others'

/** 分组名非法字符（/ 为路径分隔符，由首尾规则单独校验） */
export const INVALID_GROUP_CHARS = new RegExp(`[\\\\:*?"\\u003c\\u003e|${String.fromCharCode(0)}]`)

/**
 * 是否包含非法标签字符
 * @param value 标签值
 * @returns 是否包含非法标签字符
 */
export function hasInvalidLabelChars(value: string | null | undefined) {
  return INVALID_LABEL_CHARS.test(String(value ?? ''))
}

/**
 * 是否包含非法分组字符
 * @param value 分组值
 * @returns 是否包含非法分组字符
 */
export function hasInvalidGroupChars(value: string | null | undefined) {
  return INVALID_GROUP_CHARS.test(String(value ?? ''))
}

/**
 * 过滤文件名非法字符，保留可读标签（终端导出等）
 * @param raw 原始值
 * @returns 过滤后的值
 */
export function safeFileToken(raw: string | null | undefined) {
  return String(raw || 'session')
    .replace(INVALID_LABEL_CHARS, '')
    .replace(/\s+/g, '_')
    .replace(/^[._]+|[._]+$/g, '')
    .trim() || 'session'
}
