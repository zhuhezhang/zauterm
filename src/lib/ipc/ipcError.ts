import type { IpcThrownError } from '../../types/common'
import type { IpcContent, IpcResult } from '../../../shared/ipc'
import { ipcContent, ipcErrorFields, isIpcSuccess } from './ipcResponse'

/**
 * 将 IPC 响应转为 Error (保留 errorParams / errorKnown 供 formatThrownIpcError)
 * @param res 错误响应对象
 * @returns IpcThrownError
 */
export function ipcErrorFromResponse(res: IpcResult | null | undefined): IpcThrownError {
  const { error, errorParams, errorKnown } = ipcErrorFields(res)
  const e = new Error(error) as IpcThrownError
  if (errorParams) e.errorParams = errorParams
  e.errorKnown = errorKnown
  return e
}

/**
 * 非 success 时抛出 ipcErrorFromResponse；用于 await invoke 后的统一校验
 * @param res 错误响应对象
 * @returns 返回响应对象
 */
export function assertIpcSuccess<T extends IpcContent = IpcContent>(
  res: IpcResult<T> | null | undefined,
): IpcResult<T> & { success: true } {
  if (!isIpcSuccess(res)) {
    throw ipcErrorFromResponse(
      res ?? { success: false, errorKnown: true, content: { error: 'app.invalidRequest' } },
    )
  }
  return res
}

/**
 * assertIpcSuccess + 返回 content
 * @param res 错误响应对象
 * @returns 返回业务载荷
 */
export function unwrapIpcOk<T extends IpcContent = IpcContent>(
  res: IpcResult<T> | null | undefined,
): T {
  return ipcContent(assertIpcSuccess(res)) as T
}
