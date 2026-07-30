import { describe, expect, it } from 'vitest'
import { mergeImportedSessions } from '../../src/lib/import/mergeImportedSessions'
import type { SavedSession } from '../../src/types/session'
import type { SessionImportWarning } from '../../src/types/common'

function sshSaved(
  savedId: string,
  label: string,
  group = '',
): SavedSession {
  return {
    type: 'ssh',
    savedId,
    label,
    group,
    host: '10.0.0.1',
    port: 22,
  }
}

describe('mergeImportedSessions', () => {
  it('appends non-conflicting sessions', () => {
    const existing = [sshSaved('a', 'Lab')]
    const imported = [sshSaved('b', 'Prod', 'servers')]
    const warnings: SessionImportWarning[] = []

    const merged = mergeImportedSessions(existing, imported, warnings)

    expect(merged).toHaveLength(2)
    expect(merged[1].savedId).toBe('b')
    expect(warnings).toEqual([])
  })

  it('skips duplicate savedId with warning', () => {
    const existing = [sshSaved('dup', 'One')]
    const imported = [sshSaved('dup', 'Other label')]
    const warnings: SessionImportWarning[] = []

    const merged = mergeImportedSessions(existing, imported, warnings)

    expect(merged).toHaveLength(1)
    expect(warnings).toEqual([
      {
        code: 'mergeDuplicateSavedId',
        params: { index: 1, savedId: 'dup', label: 'Other label' },
      },
    ])
  })

  it('skips duplicate label in same group with warning', () => {
    const existing = [sshSaved('a', 'Web', 'prod')]
    const imported = [sshSaved('b', 'Web', 'prod')]
    const warnings: SessionImportWarning[] = []

    const merged = mergeImportedSessions(existing, imported, warnings)

    expect(merged).toHaveLength(1)
    expect(warnings[0]?.code).toBe('mergeDuplicateLabel')
    expect(warnings[0]?.params).toMatchObject({
      index: 1,
      savedId: 'b',
      label: 'Web',
      group: 'prod',
    })
  })

  it('allows same label in different groups', () => {
    const existing = [sshSaved('a', 'Web', 'prod')]
    const imported = [sshSaved('b', 'Web', 'staging')]
    const warnings: SessionImportWarning[] = []

    const merged = mergeImportedSessions(existing, imported, warnings)

    expect(merged).toHaveLength(2)
    expect(warnings).toEqual([])
  })
})
