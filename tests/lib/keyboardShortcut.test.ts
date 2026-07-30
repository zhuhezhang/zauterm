import { describe, expect, it, vi } from 'vitest'
import { terminalSearchShortcutLabel } from '../../src/lib/keyboardShortcut'

describe('terminalSearchShortcutLabel', () => {
  it('returns Mac label on macOS user agent', () => {
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    })
    expect(terminalSearchShortcutLabel()).toBe('⌘⇧F')
  })

  it('returns Windows label on Windows user agent', () => {
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    })
    expect(terminalSearchShortcutLabel()).toBe('Ctrl+Shift+F')
  })
})
