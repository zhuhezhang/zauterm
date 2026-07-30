import type { HighlightRule } from '../../types/settings'
import { translateRender } from '../../i18n/translateRender'
import { resolveEffectiveUiLanguage } from '../resolveUiLanguage'

/**
 * 创建一个新的高亮规则 ID
 * @returns 新的高亮规则 ID(格式为 rule-${Date.now()}-${Math.random().toString(36).slice(2, 6)})
 */
export function createHighlightRuleId(): string {
  return `rule-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

/**
 * 解析高亮规则 ID
 * @param rawId 原始 ID
 * @param usedIds 已使用的 ID 集合
 * @returns 解析后的 ID
 */
export function resolveHighlightRuleId(rawId: unknown, usedIds: Set<string>): string {
  const trimmed = typeof rawId === 'string' ? rawId.trim() : ''
  if (trimmed) return trimmed
  for (let i = 0; i < 100; i++) {
    const candidate = createHighlightRuleId()
    if (!usedIds.has(candidate)) return candidate
  }
  return `${createHighlightRuleId()}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * 生成未命名高亮规则的标签
 * @param lang 语言
 * @param n 序号
 * @returns 未命名高亮规则的标签
 */
export function unnamedHighlightRuleLabel(lang: 'zh' | 'en', n: number): string {
  return translateRender(lang === 'en' ? 'en' : 'zh', 'settings.unnamedRule', { n })
}

/**
 * 解析高亮规则名称
 * @param rawName 原始名称
 * @param usedNames 已使用的名称集合
 * @param lang 语言
 * @param startN 起始序号
 * @returns 解析后的名称
 */
export function resolveHighlightRuleName(
  rawName: unknown,
  usedNames: Set<string>,
  lang: 'zh' | 'en',
  startN = 1,
): string {
  const trimmed = String(rawName ?? '').trim()
  if (trimmed) return trimmed

  const locale = lang === 'en' ? 'en' : 'zh'
  for (let n = startN; n < 10000; n++) {
    const candidate = translateRender(locale, 'settings.unnamedRule', { n })
    if (!usedNames.has(candidate)) return candidate
  }
  return `${translateRender(locale, 'settings.unnamedRule', { n: startN })}-${Date.now()}`
}

/**
 * 规范化高亮规则列表
 * @param rules 高亮规则列表
 * @param lang 语言
 * @returns 规范化后的高亮规则列表
 */
export function normalizeHighlightRulesForSave(
  rules: HighlightRule[] | null | undefined,
  lang: string,
): HighlightRule[] {
  const effectiveLang = resolveEffectiveUiLanguage(lang)
  const safeList = rules ?? []

  return safeList.map((rule, index) => {
    const trimmed = String(rule?.name ?? '').trim()
    const displayName = trimmed || unnamedHighlightRuleLabel(effectiveLang, index + 1)
    return { ...rule, name: displayName }
  })
}
