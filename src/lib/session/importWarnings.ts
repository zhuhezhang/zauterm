import type { TranslateFn } from '../../types/common'
import type { SessionImportWarning } from '../../types/common'
import { SESSION_GROUP_LABEL_ERROR_KEYS } from './defaults'

/**
 * 格式化会话跳过原因
 * @param t 翻译函数
 * @param reason 跳过原因
 * @returns 返回格式化后的跳过原因
 */
function formatSessionSkipReason(t: TranslateFn, reason: string): string {
  const connectKey =
    SESSION_GROUP_LABEL_ERROR_KEYS[reason as keyof typeof SESSION_GROUP_LABEL_ERROR_KEYS]
  if (connectKey) {
    const msg = t(connectKey)
    if (msg !== connectKey) return msg
  }
  const key = `settings.importSessionWarnings.skipReason.${reason}`
  const msg = t(key)
  return msg !== key ? msg : reason
}

/**
 * 格式化会话导入警告
 * @param t 翻译函数
 * @param warning 导入警告
 * @returns 返回格式化后的导入警告
 */
export function formatSessionImportWarning(
  t: TranslateFn,
  warning: SessionImportWarning,
): string {
  const params: Record<string, string | number> = { ...(warning.params || {}) }
  if (typeof params.field === 'string') {
    const labelKey = `connect.${params.field}`
    const label = t(labelKey)
    params.fieldLabel = label !== labelKey ? label : params.field
  }
  if (typeof params.reason === 'string') {
    params.reasonText = formatSessionSkipReason(t, params.reason)
  }
  if (warning.code === 'mergeDuplicateLabel') {
    const g = String(params.group ?? '').trim()
    params.group = g || t('settings.importSessionWarnings.ungrouped')
  }
  const key = `settings.importSessionWarnings.${warning.code}`
  const msg = t(key, params)
  return msg !== key ? msg : warning.code
}
