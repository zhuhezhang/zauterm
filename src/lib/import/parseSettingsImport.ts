import { createImportError } from './handleImportErrors'
import { parseImportJsonText, unwrapExportPayload } from './parseImportFile'
import { sanitizeImportedSettings } from '../settings/sanitizeImport'
import type { AppSettings } from '../../types/settings'
import type { SettingsImportWarning } from '../../types/common'

/**
 * 判断是否为纯对象
 * @param raw 待判断的对象
 * @returns 是否为纯对象
 */
function isPlainObject(raw: unknown): raw is Partial<AppSettings> {
  return raw != null && typeof raw === 'object' && !Array.isArray(raw)
}

/**
 * 验证并解析设置导入 JSON 文本
 * @param content 导入的 JSON 文本
 * @param currentSettings 导入前的当前设置
 * @returns 解析后的设置对象和导入警告列表
 */
export async function validateAndParseSettingsImportContent(
  content: string,
  currentSettings: AppSettings,
): Promise<{ settings: AppSettings; warnings: SettingsImportWarning[] }> {
  const parsed = parseImportJsonText(content)
  const data = unwrapExportPayload(parsed, 'settings')
  if (!isPlainObject(data)) {
    throw createImportError('invalidPayload')
  }
  return await sanitizeImportedSettings(data, currentSettings)
}
