import type { IpcContent, IpcResult } from '../../../shared/ipc'
import type { SerialPortInfo, VaultGetContent } from '../../../shared/zterm-api'

/** IPC 响应对象 */
type IpcLike = IpcResult<IpcContent> | null | undefined

/**
 * 判断是否为 IPC 成功响应
 * @param res 错误响应对象
 * @returns 是否为 IPC 成功响应
 */
export function isIpcSuccess(res: IpcLike): res is Extract<IpcLike, { success: true }> {
  return res != null && res.success === true
}

/**
 * 判断是否为 IPC 失败响应
 * @param res 错误响应对象
 * @returns 是否为 IPC 失败响应
 */
export function isIpcFailure(res: IpcLike): res is Extract<IpcLike, { success: false }> {
  return res != null && res.success === false
}

/**
 * 获取 IPC 响应的 content
 * @param res 错误响应对象
 * @returns 返回 content
 */
export function ipcContent<T extends IpcContent = IpcContent>(res: IpcLike): T {
  return (res?.content && typeof res.content === 'object' ? res.content : {}) as T
}

/**
 * 获取 IPC 响应的错误字段
 * @param res 错误响应对象
 * @returns 返回错误字段
 */
export function ipcErrorFields(res: IpcLike): {
  error: string
  errorParams: Record<string, string | number> | undefined
  errorKnown: boolean
} {
  const c = ipcContent(res)
  const errorParams =
    c.errorParams && typeof c.errorParams === 'object'
      ? (c.errorParams as Record<string, string | number>)
      : undefined

  return {
    error: String(c.error ?? ''),
    errorParams,
    errorKnown: res?.success === false ? res.errorKnown !== false : true,
  }
}

/**
 * 获取 IPC 响应的 path
 * @param res 错误响应对象
 * @returns 返回 path
 */
export function ipcPathFromResponse(res: IpcLike): string {
  if (!isIpcSuccess(res)) return ''
  const p = res.content?.path
  return typeof p === 'string' ? p : ''
}

/**
 * 获取 IPC 响应的 ports
 * @param res 错误响应对象
 * @returns 返回 ports
 */
export function ipcPortsFromResponse(res: IpcLike): SerialPortInfo[] {
  const content = ipcContent<{ ports?: SerialPortInfo[] }>(res)
  return Array.isArray(content.ports) ? content.ports : []
}

/**  vault 密钥类型 */
const VAULT_SECRET_KEYS = ['password', 'privateKey', 'passphrase'] as const

/**
 * 获取 IPC 响应的 vault 密钥
 * @param res 错误响应对象
 * @returns 返回 vault 密钥
 */
export function vaultSecretsFromGetResponse(
  res: IpcResult<VaultGetContent> | null | undefined,
): { password?: string; privateKey?: string; passphrase?: string } {
  if (!isIpcSuccess(res)) return {}
  const c = res.content
  if (!('found' in c) || c.found !== true) return {}

  const secrets: { password?: string; privateKey?: string; passphrase?: string } = {}
  for (const k of VAULT_SECRET_KEYS) {
    const value = c[k]
    if (typeof value === 'string' && value) secrets[k] = value
  }
  return secrets
}
