import type { TranslateFn } from '../../types/common'
import type { AppSettings } from '../../types/settings'
import type { SavedSession } from '../../types/session'
import { buildExportEnvelope } from './parseImportFile'
import { EXPORT_FILENAME_PREFIX } from './constants'
import { alertIpcFailure } from '../ipc/formatIpcError'

/** 导出类型 */
type ExportKind = keyof typeof EXPORT_FILENAME_PREFIX

/**
 * 构建导出文件名
 * @param kind 导出类型
 * @returns 导出文件名
 */
export function buildExportFilename(kind: ExportKind): string {
  const now = new Date()
  const date = now.toISOString().slice(0, 10).replace(/-/g, '')
  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  const ss = String(now.getSeconds()).padStart(2, '0')
  return `${EXPORT_FILENAME_PREFIX[kind]}-${date}-${hh}${mm}${ss}.json`
}

/**
 * 下载 JSON 导出（保存会话或设置到本地）
 * @param kind 导出类型
 * @param data 导出数据
 * @param t 翻译函数
 * @returns 导出结果
 */
export async function downloadJsonExport(
  kind: ExportKind,
  data: SavedSession[] | AppSettings,
  t: TranslateFn,
): Promise<void> {
  const payload =
    kind === 'sessions'
      ? buildExportEnvelope('sessions', data as SavedSession[])
      : buildExportEnvelope('settings', data as AppSettings)
  const jsonText = JSON.stringify(payload, null, 2)
  const filename = buildExportFilename(kind)
  try {
    const res = await window.zterm?.save?.saveFile(kind, filename, jsonText)
    if (res?.content?.canceled) return
    if (alertIpcFailure(t, res, 'settings.exportFail')) return
    if (kind === 'sessions') {
      alert(t('settings.exportSessionsOk', { n: (data as SavedSession[]).length }))
    } else {
      alert(t('settings.exportSettingsOk'))
    }
  } catch (err: unknown) {
    alert(t('settings.exportFail', {
      msg: err instanceof Error ? err.message : String(err),
    }))
  }
}
