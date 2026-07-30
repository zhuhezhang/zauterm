import { describe, it, expect } from 'vitest'
import { buildTree, flattenVisibleTree } from '../../src/lib/session/tree'

describe('session tree', () => {
  it('buildTree groups sessions and sorts', () => {
    const tree = buildTree(
      [
        { savedId: 'b', type: 'ssh', label: 'B', group: 'g1' },
        { savedId: 'a', type: 'ssh', label: 'A', group: '' },
      ],
      ['g1'],
    )
    expect(tree.some(n => n.type === 'group' && n.path === 'g1')).toBe(true)
    const ungrouped = tree.filter(n => n.type === 'session')
    expect(ungrouped[0].name).toBe('A')
  })

  it('flattenVisibleTree respects expansion', () => {
    const tree = buildTree([{ savedId: 's1', type: 'ssh', label: 'S', group: 'g' }], ['g'])
    const flat = flattenVisibleTree(tree, () => false)
    expect(flat.some(i => i.type === 'group')).toBe(true)
    expect(flat.some(i => i.type === 'session')).toBe(false)
  })
})
