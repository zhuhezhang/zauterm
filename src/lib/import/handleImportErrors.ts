import { formatIpcResponseError } from '../ipc/formatIpcError'
import type { TranslateFn } from '../../types/common'
import type { ImportError } from '../../types/common'

/**
 * 创建导入错误，用于在导入过程中抛出错误
 * @param code 错误代码
 * @param params 错误参数
 * @returns 导入错误
 */
export function createImportError(
  code: string,
  params?: Record<string, string | number>,
): ImportError {
  const err = new Error(code) as ImportError
  err.code = code
  if (params) err.params = params
  return err
}

/**
 * 判断是否为导入路径拒绝错误
 * @param err 错误
 * @returns 是否为导入路径拒绝错误
 */
export function isImportPathDeniedError(err: unknown): err is ImportError {
  return !!err && typeof err === 'object' && 'code' in err && (err as ImportError).code === 'pathDenied'
}

/**
 * 格式化导入路径拒绝消息
 * @param t 翻译函数
 * @param err 错误
 * @returns 导入路径拒绝消息
 */
export function formatImportPathDeniedMessage(t: TranslateFn, err: unknown): string {
  const importErr = err as ImportError
  const ipcMsg = importErr.ipc ? formatIpcResponseError(t, importErr.ipc) : ''
  if (ipcMsg) return ipcMsg
  return t('settings.importPathDenied', { hint: t('sftp.pathErrors.allowedRootsHint') })
}

/**
 * 格式化导入错误
 * @param t 翻译函数
 * @param err 错误
 * @returns 导入错误
 */
export function formatImportError(t: TranslateFn, err: unknown): string {
  const importErr = err as ImportError
  const code = err && typeof err === 'object' && 'code' in err ? importErr.code : null
  if (typeof code === 'string') {
    const key = `settings.importErrors.${code}`
    const params = { ...(importErr.params || {}) }
    if (code === 'wrongFileType' && params.kindKey) {
      params.kind = t(`settings.importFileKind.${params.kindKey}`)
      delete params.kindKey
    }
    const msg = t(key, params)
    if (msg !== key) return msg
  }
  if (err instanceof Error && err.message) return err.message
  return String(err ?? '')
}

/**
 * 报告导入错误
 * @param t 翻译函数
 * @param err 错误
 * @returns 导入错误
 */
export function reportImportError(t: TranslateFn, err: unknown): void {
  if (isImportPathDeniedError(err)) {
    alert(formatImportPathDeniedMessage(t, err))
    return
  }
  alert(t('settings.importFail', { msg: formatImportError(t, err) }))
}
