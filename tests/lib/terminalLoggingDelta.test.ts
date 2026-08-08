import { describe, expect, it } from 'vitest'
import { diffCommittedLogDelta } from '../../src/lib/terminal/terminalLogging'

describe('diffCommittedLogDelta', () => {
  it('returns empty delta when unchanged', () => {
    expect(diffCommittedLogDelta('a\nb', 'a\nb')).toEqual({ delta: '', committed: 'a\nb' })
  })

  it('appends suffix when next grows as prefix of prev', () => {
    expect(diffCommittedLogDelta('hello', 'hello\nworld')).toEqual({
      delta: '\nworld',
      committed: 'hello\nworld',
    })
  })

  it('writes full next when prev is empty', () => {
    expect(diffCommittedLogDelta('', 'line1\nline2')).toEqual({
      delta: 'line1\nline2',
      committed: 'line1\nline2',
    })
  })

  it('recovers scrollback trim via line overlap', () => {
    expect(diffCommittedLogDelta('A\nB\nC\nD\nE', 'B\nC\nD\nE\nF')).toEqual({
      delta: '\nF',
      committed: 'B\nC\nD\nE\nF',
    })
  })

  it('separates clear/redraw with blank line when no overlap', () => {
    expect(diffCommittedLogDelta('old\ncontent', 'prompt>')).toEqual({
      delta: '\n\nprompt>',
      committed: 'prompt>',
    })
  })

  it('returns empty delta when next is empty after clear', () => {
    expect(diffCommittedLogDelta('old', '')).toEqual({
      delta: '',
      committed: '',
    })
  })
})
