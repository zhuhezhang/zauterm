import { describe, it, expect } from 'vitest'
import { assertIpcSuccess, ipcErrorFromResponse } from '../../src/lib/ipc/ipcError'
import { ipcPathFromResponse, ipcPortsFromResponse, vaultSecretsFromGetResponse } from '../../src/lib/ipc/ipcResponse'

describe('ipcPathFromResponse', () => {
  it('reads path from content on success', () => {
    expect(ipcPathFromResponse({ success: true, content: { path: '/Users/x/Downloads' } })).toBe(
      '/Users/x/Downloads',
    )
  })

  it('returns empty when failed or missing', () => {
    expect(ipcPathFromResponse({ success: false, errorKnown: true, content: { error: 'x' } })).toBe('')
  })
})

describe('ipcPortsFromResponse', () => {
  it('reads ports on success', () => {
    expect(ipcPortsFromResponse({ success: true, content: { ports: [{ path: 'COM1' }] } })).toEqual([
      { path: 'COM1' },
    ])
  })

  it('reads ports from failed response contentExtra', () => {
    expect(
      ipcPortsFromResponse({
        success: false,
        errorKnown: true,
        content: { error: 'serial.moduleUnavailable', ports: [] },
      }),
    ).toEqual([])
  })
})

describe('vaultSecretsFromGetResponse', () => {
  it('returns secrets when found', () => {
    expect(
      vaultSecretsFromGetResponse({
        success: true,
        content: { found: true, password: 'p', privateKey: 'k' },
      }),
    ).toEqual({ password: 'p', privateKey: 'k' })
  })

  it('returns empty when found is false', () => {
    expect(
      vaultSecretsFromGetResponse({
        success: true,
        content: { found: false, reason: 'notInVault' },
      }),
    ).toEqual({})
  })
})

describe('assertIpcSuccess', () => {
  it('returns res on success', () => {
    const res = { success: true as const, content: {} }
    expect(assertIpcSuccess(res)).toBe(res)
  })

  it('throws ipc-shaped error on failure', () => {
    expect(() =>
      assertIpcSuccess({
        success: false,
        errorKnown: true,
        content: { error: 'ssh.connectionFailed' },
      }),
    ).toThrow('ssh.connectionFailed')
  })
})

describe('ipcErrorFromResponse', () => {
  it('reads error fields from content', () => {
    expect(
      ipcErrorFromResponse({
        success: false,
        errorKnown: false,
        content: { error: 'ECONNREFUSED' },
      }),
    ).toMatchObject({
      message: 'ECONNREFUSED',
      errorKnown: false,
    })
  })
})
