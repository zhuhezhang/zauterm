import { describe, it, expect } from 'vitest'
import { isSerialPathInEnumeratedList } from '../../shared/isSerialPathInEnumeratedList'

describe('isSerialPathInEnumeratedList', () => {
  it('returns false for empty path', () => {
    expect(isSerialPathInEnumeratedList('', [{ path: '/dev/ttyUSB0' }])).toBe(false)
    expect(isSerialPathInEnumeratedList('  ', [{ path: '/dev/ttyUSB0' }])).toBe(false)
  })

  it('matches exact path on non-win32', () => {
    expect(isSerialPathInEnumeratedList('/dev/ttyUSB0', [{ path: '/dev/ttyUSB0' }])).toBe(true)
    expect(isSerialPathInEnumeratedList('/dev/missing', [{ path: '/dev/ttyUSB0' }])).toBe(false)
  })

  it('is case-insensitive on win32', () => {
    const prev = process.platform
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true })
    try {
      expect(isSerialPathInEnumeratedList('COM3', [{ path: 'com3' }])).toBe(true)
      expect(isSerialPathInEnumeratedList('com9', [{ path: 'COM9' }])).toBe(true)
    } finally {
      Object.defineProperty(process, 'platform', { value: prev, configurable: true })
    }
  })
})
