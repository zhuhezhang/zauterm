import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  createImportError,
  reportImportError,
} from '../../src/lib/import/handleImportErrors'
import { translateRender } from '../../src/i18n/translateRender'

const t = (path: string, params?: Record<string, string | number>) =>
  translateRender('zh-CN', path, params)

describe('handleImportErrors', () => {
  beforeEach(() => {
    vi.stubGlobal('alert', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('path denied alert does not double-prefix 导入失败', () => {
    const err = createImportError('pathDenied')
    err.ipc = {
      success: false,
      errorKnown: true,
      content: { error: 'sftp.pathErrors.localDirDenied', errorParams: { kind: 'import' } },
    }
    reportImportError(t, err)
    const msg = String((alert as ReturnType<typeof vi.fn>).mock.calls[0][0])
    expect(msg).toMatch(/^导入失败：/)
    expect(msg).not.toMatch(/导入失败：导入失败/)
  })
})
