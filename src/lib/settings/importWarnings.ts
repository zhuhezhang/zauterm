import type { TranslateFn } from '../../types/common'
import type { SettingsImportWarning } from '../../types/common'

/**
 * 添加导入警告
 * @param warnings 导入警告列表
 * @param code 警告代码
 * @param params 警告参数
 */
export function pushSettingsImportWarning(
  warnings: { code: string; params?: Record<string, string | number> }[],
  code: string,
  params?: Record<string, string | number>,
) {
  warnings.push({ code, ...(params ? { params } : {}) })
}

/**
 * 解析字段标签
 * @param t 翻译函数
 * @param fieldKey 字段键
 * @returns 字段标签
 */
function resolveFieldLabel(t: TranslateFn, fieldKey: string): string {
  const labelKey = `settings.fields.${fieldKey}.label`
  const label = t(labelKey)
  return label !== labelKey ? label : fieldKey
}

/**
 * 解析算法段标签
 * @param t 翻译函数
 * @param sectionKey 算法段键
 * @returns 算法段标签
 */
function resolveAlgoSectionLabel(t: TranslateFn, sectionKey: string): string {
  const labelKey = `settings.algo.${sectionKey}`
  const label = t(labelKey)
  return label !== labelKey ? label : sectionKey
}

/**
 * 格式化高亮规则原因
 * @param t 翻译函数
 * @param reason 原因
 * @param params 原因参数
 * @returns 格式化后的原因
 */
function formatHighlightRuleReason(
  t: TranslateFn,
  reason: string,
  params?: Record<string, string>,
): string {
  const key = `settings.importWarnings.highlightRuleReason.${reason}`
  const msg = t(key, params || {})
  return msg !== key ? msg : reason
}

/**
 * 格式化导入警告
 * @param t 翻译函数
 * @param warning 导入警告
 * @returns 格式化后的导入警告
 */
export function formatSettingsImportWarning(t: TranslateFn, warning: SettingsImportWarning): string {
  const params: Record<string, unknown> = { ...(warning.params || {}) }
  if (typeof params.field === 'string') {
    params.fieldLabel = resolveFieldLabel(t, params.field)
  }
  if (typeof params.section === 'string') {
    params.sectionLabel = resolveAlgoSectionLabel(t, params.section)
  }
  if (typeof params.reason === 'string') {
    const reasonParams: Record<string, string> = {}
    if (typeof params.id === 'string') reasonParams.id = params.id
    if (typeof params.name === 'string') reasonParams.name = params.name
    params.reasonText = formatHighlightRuleReason(t, params.reason as string, reasonParams)
  }
  const key = `settings.importWarnings.${warning.code}`
  const msg = t(key, params as Record<string, string | number>)
  return msg !== key ? msg : `${warning.code}${params.field ? ` (${params.field})` : ''}`
}

/**
 * 格式化导入警告列表
 * @param t 翻译函数
 * @param warnings 导入警告列表
 * @returns 格式化后的导入警告列表
 */
export function formatSettingsImportWarnings(
  t: TranslateFn,
  warnings: SettingsImportWarning[],
): string {
  if (!warnings?.length) return ''
  return warnings.map((w) => formatSettingsImportWarning(t, w)).join('\n')
}

/** 高亮规则因 id / name 重复而跳过的 reason 码 */
const DUPLICATE_HIGHLIGHT_RULE_REASONS = new Set(['duplicateId', 'duplicateName'])

/**
 * 判断是否为重复高亮规则警告（不写入明细，仅汇总为 duplicateNote）
 * @param warning 导入警告
 * @returns 是否为重复高亮规则警告
 */
function isDuplicateHighlightRuleWarning(warning: SettingsImportWarning): boolean {
  return (
    warning.code === 'highlightRuleSkipped'
    && typeof warning.params?.reason === 'string'
    && DUPLICATE_HIGHLIGHT_RULE_REASONS.has(warning.params.reason)
  )
}

/**
 * 报告设置导入结果：重复高亮规则只提示已忽略，其余警告仍列明细
 * @param t 翻译函数
 * @param warnings 导入警告列表
 */
export function reportSettingsImportResult(
  t: TranslateFn,
  warnings: SettingsImportWarning[],
): void {
  const hasDuplicateWarnings = warnings.some(isDuplicateHighlightRuleWarning)
  const duplicateNote = hasDuplicateWarnings ? t('settings.importSettingsDuplicatesNote') : ''
  const otherWarnings = warnings.filter((w) => !isDuplicateHighlightRuleWarning(w))

  if (otherWarnings.length) {
    alert(t('settings.importSettingsPartial', {
      duplicateNote,
      details: formatSettingsImportWarnings(t, otherWarnings),
    }))
  } else {
    alert(t('settings.importSettingsOk', { duplicateNote }))
  }
}
