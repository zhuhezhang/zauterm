import { describe, it, expect } from 'vitest'
import { detectLangFromLocaleTags, resolveEffectiveUiLanguage } from '../../src/lib/resolveUiLanguage'

describe('detectLangFromLocaleTags', () => {
  it('detects zh variants', () => {
    expect(detectLangFromLocaleTags(['zh-CN'])).toBe('zh')
    expect(detectLangFromLocaleTags(['zh'])).toBe('zh')
  })

  it('detects en variants', () => {
    expect(detectLangFromLocaleTags(['en-US'])).toBe('en')
  })

  it('defaults to en for unknown tags', () => {
    expect(detectLangFromLocaleTags(['fr-FR'])).toBe('en')
    expect(detectLangFromLocaleTags([])).toBe('en')
  })
})

describe('resolveEffectiveUiLanguage', () => {
  it('respects explicit zh/en', () => {
    expect(resolveEffectiveUiLanguage('zh', 'en')).toBe('zh')
    expect(resolveEffectiveUiLanguage('en', 'zh')).toBe('en')
  })

  it('uses systemLang for auto', () => {
    expect(resolveEffectiveUiLanguage('auto', 'zh')).toBe('zh')
    expect(resolveEffectiveUiLanguage(undefined, 'en')).toBe('en')
  })
})
