import { describe, it, expect, vi, beforeEach } from 'vitest'
import { uiAlert } from '@/lib/ui/nativeDialog'
import {
  createImportError,
  reportImportError,
} from '../../src/lib/import/handleImportErrors'
import { translateRender } from '../../src/i18n/translateRender'

vi.mock('@/lib/ui/nativeDialog', () => ({
  uiAlert: vi.fn(),
}))

const t = (path: string, params?: Record<string, string | number>) =>
  translateRender('zh-CN', path, params)

describe('handleImportErrors', () => {
  beforeEach(() => {
    vi.mocked(uiAlert).mockClear()
  })

  it('path denied alert does not double-prefix 导入失败', () => {
    const err = createImportError('pathDenied')
    err.ipc = {
      success: false,
      errorKnown: true,
      content: { error: 'sftp.pathErrors.localDirDenied', errorParams: { kind: 'import' } },
    }
    reportImportError(t, err)
    expect(uiAlert).toHaveBeenCalledOnce()
    const msg = String(vi.mocked(uiAlert).mock.calls[0][0])
    expect(msg).toMatch(/^导入失败：/)
    expect(msg).not.toMatch(/导入失败：导入失败/)
  })
})
