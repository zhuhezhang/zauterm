import { describe, expect, it } from 'vitest'
import {
  uniqueLabelInGroup,
  addGroupPlaceholder,
  removeGroupPlaceholder,
  prunePlaceholdersForOccupiedGroups,
  vacatedNamedGroupIfEmpty,
  vacatedGroupIfMoved,
  getGroups,
  ungroupSessionsUnderPath,
} from '../../src/store/sessionStore'
import type { SavedSession } from '../../src/types/session'

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
  }
}

describe('uniqueLabelInGroup', () => {
  const sessions = [
    sshSaved('1', 'web', 'prod'),
    sshSaved('2', 'db', 'prod'),
    sshSaved('3', 'web', 'staging'),
  ]

  it('returns label when unused in group', () => {
    expect(uniqueLabelInGroup(sessions, 'prod', 'api')).toBe('api')
  })

  it('suffixes duplicate labels within the same group', () => {
    expect(uniqueLabelInGroup(sessions, 'prod', 'web')).toBe('web(1)')
    expect(uniqueLabelInGroup(sessions, 'staging', 'api')).toBe('api')
  })

  it('ignores excluded savedId when checking siblings', () => {
    expect(uniqueLabelInGroup(sessions, 'prod', 'web', '1')).toBe('web')
  })
})

describe('group placeholders', () => {
  it('adds and removes placeholders idempotently', () => {
    expect(addGroupPlaceholder(['a'], 'b')).toEqual(['a', 'b'])
    expect(addGroupPlaceholder(['a', 'b'], 'b')).toEqual(['a', 'b'])
    expect(removeGroupPlaceholder(['a', 'b'], 'a')).toEqual(['b'])
  })

  it('prunes placeholders occupied by sessions', () => {
    const sessions = [sshSaved('1', 'x', 'live')]
    expect(prunePlaceholdersForOccupiedGroups(sessions, ['live', 'empty'])).toEqual(['empty'])
  })
})

describe('vacatedNamedGroupIfEmpty', () => {
  it('returns group path when no sessions remain in it', () => {
    const next = [sshSaved('1', 'a', 'other')]
    expect(vacatedNamedGroupIfEmpty('old', next)).toBe('old')
    expect(vacatedNamedGroupIfEmpty('other', next)).toBeUndefined()
    expect(vacatedNamedGroupIfEmpty('', next)).toBeUndefined()
  })

  it('detects vacated group after move via vacatedGroupIfMoved', () => {
    const next = [sshSaved('1', 'a', 'new')]
    expect(vacatedGroupIfMoved('old', 'new', next)).toBe('old')
    expect(vacatedGroupIfMoved('old', 'old', next)).toBeUndefined()
  })
})

describe('getGroups', () => {
  it('merges session groups and placeholders then sorts', () => {
    expect(
      getGroups(
        [sshSaved('1', 'a', 'b'), sshSaved('2', 'b', 'a')],
        ['c', 'a'],
      ),
    ).toEqual(['a', 'b', 'c'])
  })
})

describe('ungroupSessionsUnderPath', () => {
  it('clears group for nested sessions and deduplicates labels at root', () => {
    const sessions = [
      sshSaved('1', 'web', 'ops/prod'),
      sshSaved('2', 'web', 'ops/stage'),
      sshSaved('3', 'web', ''),
    ]
    const next = ungroupSessionsUnderPath(sessions, 'ops')

    expect(next.find((s) => s.savedId === '1')?.group).toBe('')
    expect(next.find((s) => s.savedId === '2')?.group).toBe('')
    expect(next.find((s) => s.savedId === '1')?.label).toBe('web(1)')
    expect(next.find((s) => s.savedId === '3')?.label).toBe('web')
  })
})
