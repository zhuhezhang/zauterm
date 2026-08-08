import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '../../src/lib/settings/defaults'
import { sanitizeImportedSettings } from '../../src/lib/settings/sanitizeImport'

describe('sanitizeImportedSettings', () => {
  it('returns current settings for non-object input', async () => {
    const { settings, warnings } = await sanitizeImportedSettings('bad', DEFAULT_SETTINGS)
    expect(settings.appTheme).toBe(DEFAULT_SETTINGS.appTheme)
    expect(warnings).toEqual([])
  })

  it('rejects invalid appTheme enum', async () => {
    const { settings, warnings } = await sanitizeImportedSettings(
      { appTheme: 'neon' },
      DEFAULT_SETTINGS,
    )
    expect(settings.appTheme).toBe(DEFAULT_SETTINGS.appTheme)
    expect(warnings.some(w => w.code === 'invalidEnum' && w.params?.field === 'appTheme')).toBe(true)
  })

  it('rejects invalid terminalFontFamily enum', async () => {
    const { settings, warnings } = await sanitizeImportedSettings(
      { terminalFontFamily: 'comic-sans' },
      DEFAULT_SETTINGS,
    )
    expect(settings.terminalFontFamily).toBe(DEFAULT_SETTINGS.terminalFontFamily)
    expect(warnings.some(w => w.code === 'invalidEnum' && w.params?.field === 'terminalFontFamily')).toBe(true)
  })

  it('coerces invalid boolean fields', async () => {
    const { settings, warnings } = await sanitizeImportedSettings(
      { confirmDeleteSession: 'yes' },
      DEFAULT_SETTINGS,
    )
    expect(settings.confirmDeleteSession).toBe(DEFAULT_SETTINGS.confirmDeleteSession)
    expect(warnings.some(w => w.code === 'invalidBoolean' && w.params?.field === 'confirmDeleteSession')).toBe(true)
  })

  it('clamps terminalScrollback out of range', async () => {
    const { settings, warnings } = await sanitizeImportedSettings(
      { terminalScrollback: 9_999_999 },
      DEFAULT_SETTINGS,
    )
    expect(settings.terminalScrollback).toBeLessThanOrEqual(500_000)
    expect(warnings.some(w => w.code === 'valueClamped' && w.params?.field === 'terminalScrollback')).toBe(true)
  })

  it('accepts valid partial import', async () => {
    const { settings, warnings } = await sanitizeImportedSettings(
      { appTheme: 'dark', uiLanguage: 'en', loggingMode: 'buffer' },
      DEFAULT_SETTINGS,
    )
    expect(settings.appTheme).toBe('dark')
    expect(settings.uiLanguage).toBe('en')
    expect(settings.loggingMode).toBe('session')
    expect(warnings).toEqual([])
  })
})
