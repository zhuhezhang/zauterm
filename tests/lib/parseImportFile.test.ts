import { describe, it, expect } from 'vitest'
import { unwrapExportPayload, buildExportEnvelope } from '../../src/lib/import/parseImportFile'
import { EXPORT_ENVELOPE_VERSION } from '../../src/lib/import/constants'
import { DEFAULT_SETTINGS } from '../../src/lib/settings/defaults'
import type { SavedSession } from '../../src/types/session'

const sampleSession: SavedSession = {
  type: 'ssh',
  savedId: 'saved-1',
  label: 'lab',
  group: '',
  host: '192.168.1.1',
}

describe('parseImportFile envelope', () => {
  it('buildExportEnvelope wraps data', () => {
    const env = buildExportEnvelope('sessions', [sampleSession])
    expect(env.ztermExport).toBe('sessions')
    expect(env.version).toBe(EXPORT_ENVELOPE_VERSION)
    expect(env.data).toEqual([sampleSession])
  })

  it('unwrapExportPayload accepts sessions array', () => {
    const env = buildExportEnvelope('sessions', [sampleSession])
    expect(unwrapExportPayload(env, 'sessions')).toEqual([sampleSession])
  })

  it('unwrapExportPayload rejects wrong kind', () => {
    const env = buildExportEnvelope('settings', DEFAULT_SETTINGS)
    expect(() => unwrapExportPayload(env, 'sessions')).toThrow()
  })

  it('unwrapExportPayload rejects bad version', () => {
    const env = { ztermExport: 'sessions', version: 99, data: [] }
    expect(() => unwrapExportPayload(env, 'sessions')).toThrow()
  })
})
