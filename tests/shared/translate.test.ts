import { describe, it, expect } from 'vitest'
import { translate } from '../../shared/translate'

describe('translate', () => {
  const MESSAGES = {
    zh: { greet: '你好 {name}' },
    en: { greet: 'Hi {name}' },
  }

  it('replaces params', () => {
    expect(translate('zh', MESSAGES, 'greet', { name: 'Z' })).toBe('你好 Z')
  })
})
