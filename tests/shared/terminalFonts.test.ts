import { describe, expect, it } from 'vitest'
import {
  DEFAULT_TERMINAL_FONT_FAMILY,
  normalizeTerminalFontFamilyKey,
  resolveTerminalFontFamily,
} from '../../shared/terminalFonts'

describe('terminalFonts', () => {
  it('normalizes known preset keys', () => {
    expect(normalizeTerminalFontFamilyKey('jetbrains')).toBe('jetbrains')
    expect(normalizeTerminalFontFamilyKey('JETBRAINS')).toBe('jetbrains')
  })

  it('falls back for unknown keys', () => {
    expect(normalizeTerminalFontFamilyKey('comic-sans')).toBe(DEFAULT_TERMINAL_FONT_FAMILY)
    expect(normalizeTerminalFontFamilyKey(undefined)).toBe(DEFAULT_TERMINAL_FONT_FAMILY)
  })

  it('resolves fontFamily strings for presets', () => {
    expect(resolveTerminalFontFamily('jetbrains')).toContain('JetBrains Mono')
    expect(resolveTerminalFontFamily('bad')).toContain('Cascadia Code')
  })
})
