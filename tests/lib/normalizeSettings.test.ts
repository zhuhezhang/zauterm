import { describe, expect, it } from 'vitest'
import {
  clampSidebarWidthPx,
  clampTerminalScrollback,
  clampSshKeepaliveInterval,
  clampSettingsNumberField,
  normalizeLoggingMode,
  isLikelyAbsoluteLogPath,
} from '../../src/lib/settings/normalize'
import {
  DEFAULT_SIDEBAR_WIDTH,
  TERMINAL_SCROLLBACK_DEFAULT,
  TERMINAL_SCROLLBACK_MIN,
  TERMINAL_SCROLLBACK_MAX,
  SSH_KEEPALIVE_INTERVAL_DEFAULT,
  SSH_KEEPALIVE_INTERVAL_MAX,
} from '../../src/lib/settings/defaults'

describe('clampSidebarWidthPx', () => {
  it('returns fallback for non-finite width', () => {
    expect(clampSidebarWidthPx('wide', 1000, 280)).toBe(280)
  })

  it('clamps width to 10%–90% of inner width', () => {
    expect(clampSidebarWidthPx(10, 1000, DEFAULT_SIDEBAR_WIDTH)).toBe(100)
    expect(clampSidebarWidthPx(9999, 1000, DEFAULT_SIDEBAR_WIDTH)).toBe(900)
    expect(clampSidebarWidthPx(350, 1000, DEFAULT_SIDEBAR_WIDTH)).toBe(350)
  })
})

describe('clampTerminalScrollback', () => {
  it('uses fallback for invalid input', () => {
    expect(clampTerminalScrollback(undefined)).toBe(TERMINAL_SCROLLBACK_DEFAULT)
  })

  it('clamps to configured min and max', () => {
    expect(clampTerminalScrollback(-1)).toBe(TERMINAL_SCROLLBACK_MIN)
    expect(clampTerminalScrollback(9_999_999)).toBe(TERMINAL_SCROLLBACK_MAX)
    expect(clampTerminalScrollback(5000)).toBe(5000)
  })
})

describe('clampSshKeepaliveInterval', () => {
  it('allows zero to disable keepalive', () => {
    expect(clampSshKeepaliveInterval(0)).toBe(0)
  })

  it('uses fallback for invalid input', () => {
    expect(clampSshKeepaliveInterval('bad')).toBe(SSH_KEEPALIVE_INTERVAL_DEFAULT)
  })

  it('clamps to max interval', () => {
    expect(clampSshKeepaliveInterval(9999)).toBe(SSH_KEEPALIVE_INTERVAL_MAX)
    expect(clampSshKeepaliveInterval(60)).toBe(60)
  })
})

describe('clampSettingsNumberField', () => {
  it('routes known keys to dedicated clampers', () => {
    expect(clampSettingsNumberField('terminalScrollback', -1)).toBe(TERMINAL_SCROLLBACK_MIN)
    expect(clampSettingsNumberField('sshKeepaliveInterval', 30)).toBe(30)
  })

  it('returns 0 for unknown numeric fields with invalid input', () => {
    expect(clampSettingsNumberField('sidebarWidth', 'x')).toBe(0)
  })
})

describe('normalizeLoggingMode', () => {
  it('normalizes known modes', () => {
    expect(normalizeLoggingMode('none')).toBe('none')
    expect(normalizeLoggingMode('STREAM')).toBe('stream')
    expect(normalizeLoggingMode('')).toBe('buffer')
    expect(normalizeLoggingMode(undefined)).toBe('buffer')
  })
})

describe('isLikelyAbsoluteLogPath', () => {
  it('detects unix, windows, and UNC-like paths', () => {
    expect(isLikelyAbsoluteLogPath('/var/log')).toBe(true)
    expect(isLikelyAbsoluteLogPath('C:\\logs')).toBe(true)
    expect(isLikelyAbsoluteLogPath('D:/logs')).toBe(true)
    expect(isLikelyAbsoluteLogPath('relative/path')).toBe(false)
    expect(isLikelyAbsoluteLogPath('')).toBe(false)
  })
})
