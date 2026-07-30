import { describe, it, expect } from 'vitest'
import { formatIpcError, formatIpcResponseError, formatThrownIpcError } from '../../src/lib/ipc/formatIpcError'
import { ipcErrorFromResponse } from '../../src/lib/ipc/ipcError'
import { translateRender } from '../../src/i18n/translateRender'

describe('formatIpcError', () => {
  const t = (path: string, params?: Record<string, string | number>) => translateRender('zh', path, params)

  it('translates IPC code', () => {
    expect(formatIpcError(t, 'sftp.noSession')).toBe('没有活动的 SFTP 会话')
  })

  it('expands path kind params', () => {
    const msg = formatIpcError(t, 'sftp.pathErrors.localDirDenied', { kind: 'download' })
    expect(msg).toContain('下载')
    expect(msg).toContain('路径须位于')
  })

  it('translates read/upload path kind labels', () => {
    expect(formatIpcError(t, 'sftp.pathErrors.localDirDenied', { kind: 'read' })).toContain('读取')
    expect(formatIpcError(t, 'sftp.pathErrors.localDirDenied', { kind: 'upload' })).toContain('上传')
  })
})

describe('formatIpcResponseError', () => {
  const t = (path: string, params?: Record<string, string | number>) => translateRender('zh', path, params)

  it('translates when errorKnown is true', () => {
    expect(
      formatIpcResponseError(t, {
        success: false,
        errorKnown: true,
        content: { error: 'sftp.noSession' },
      }),
    ).toBe('没有活动的 SFTP 会话')
  })

  it('returns raw when errorKnown is false', () => {
    expect(
      formatIpcResponseError(t, {
        success: false,
        errorKnown: false,
        content: { error: 'connect ECONNREFUSED' },
      }),
    ).toBe('connect ECONNREFUSED')
  })
})

describe('formatThrownIpcError', () => {
  const t = (path: string, params?: Record<string, string | number>) => translateRender('zh', path, params)

  it('shows raw when errorKnown is false', () => {
    const e = ipcErrorFromResponse({
      success: false,
      errorKnown: false,
      content: { error: 'connect ECONNREFUSED' },
    })
    expect(formatThrownIpcError(t, e)).toBe('connect ECONNREFUSED')
  })

  it('translates IPC code when errorKnown is true', () => {
    const e = ipcErrorFromResponse({
      success: false,
      errorKnown: true,
      content: { error: 'sftp.noSession' },
    })
    expect(formatThrownIpcError(t, e)).toBe('没有活动的 SFTP 会话')
  })
})
