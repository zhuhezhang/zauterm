import type { TranslateFn } from '../../types/common'
import type { IpcThrownError } from '../../types/common'
import type { IpcResult } from '../../../shared/ipc'
import { ipcErrorFields, isIpcFailure } from './ipcResponse'

/**
 * 将 IPC 错误码译为界面文案（仅 errorKnown 为 true 时调用）
 * @param t translateRender / useI18n().t
 * @param code 错误码（如 sftp.pathErrors.localDirDenied）
 * @param params 错误参数（如{name: '张三'}）
 * @returns 展示文案
 */
export function formatIpcError(
  t: TranslateFn,
  code: unknown,
  params?: Record<string, string | number>,
): string {
  const c = String(code ?? '').trim()
  if (!c) return ''
  const p = { ...(params || {}) }
  if (p.kind && !p.kindLabel) {
    const kindKey = `sftp.pathKind.${p.kind}`
    const kindLabel = t(kindKey)
    p.kindLabel = kindLabel !== kindKey ? kindLabel : String(p.kind)
  }
  if (c.startsWith('sftp.pathErrors.') && !p.hint) {
    p.hint = t('sftp.pathErrors.allowedRootsHint')
  }
  const msg = t(c, p)
  return msg !== c ? msg : c
}

/**
 * 失败则 alert 并返回 true；成功或未失败返回 false
 * @param t 翻译函数
 * @param res 错误响应对象
 * @param fallbackKey i18n 键
 * @returns 是否已 alert
 */
export function alertIpcFailure(
  t: TranslateFn,
  res: IpcResult | null | undefined,
  fallbackKey?: string,
): boolean {
  if (!isIpcFailure(res)) return false
  alert(formatIpcResponseError(t, res) || (fallbackKey ? t(fallbackKey) : ''))
  return true
}

/**
 * 从 IPC 响应对象取展示文案（是否翻译由 errorKnown 决定）
 * @param t 翻译函数
 * @param res 错误响应对象
 * @returns 展示文案
 */
export function formatIpcResponseError(
  t: TranslateFn,
  res: IpcResult | null | undefined,
): string {
  if (!isIpcFailure(res)) return ''
  const { error, errorParams, errorKnown } = ipcErrorFields(res)
  if (errorKnown === false) return String(error ?? '')
  return formatIpcError(t, error, errorParams)
}

/**
 * 终端: ipcErrorFromResponse 抛出的 Error -> 展示文案
 * @param t 翻译函数
 * @param {unknown} err 错误对象
 * @returns {string} 展示文案
 */
export function formatThrownIpcError(t: TranslateFn, err: unknown): string {
  if (!err) return ''
  const e = err as IpcThrownError
  return formatIpcResponseError(t, {
    success: false,
    errorKnown: e.errorKnown ?? false,
    content: {
      error: e.message ?? String((err as { error?: string }).error ?? ''),
      errorParams: e.errorParams,
    },
  })
}
