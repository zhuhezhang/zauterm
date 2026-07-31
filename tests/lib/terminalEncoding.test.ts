import { describe, expect, it } from 'vitest'
import {
  DEFAULT_TERMINAL_ENCODING,
  normalizeTerminalEncoding,
} from '@/lib/terminal/terminalEncoding'

describe('normalizeTerminalEncoding', () => {
  it('defaults to utf-8', () => {
    expect(normalizeTerminalEncoding(undefined)).toBe(DEFAULT_TERMINAL_ENCODING)
    expect(normalizeTerminalEncoding('')).toBe(DEFAULT_TERMINAL_ENCODING)
  })

  it('lowercases encoding names', () => {
    expect(normalizeTerminalEncoding('UTF8').toLowerCase()).toContain('utf')
    expect(normalizeTerminalEncoding('GBK').toLowerCase()).toBe('gbk')
  })
})
