import type { AppSettings } from '../../types/settings'
import type { SavedSession } from '../../types/session'
import { createImportError } from './handleImportErrors'
import { EXPORT_ENVELOPE_VERSION } from './constants'
import { IMPORT_MAX_BYTES } from '../../../shared/others'

/** zterm 导出 envelope */
export interface ExportEnvelope<T> {
  /** 导出类型 */
  ztermExport: 'sessions' | 'settings'
  /** 导出版本 */
  version: number
  /** 导出时间 */
  exportedAt?: string
  /** 导出数据 */
  data: T
}

/**
 * 判断是否为导出 envelope
 * @param parsed 解析后的数据
 * @returns 是否为导出 envelope
 */
function isExportEnvelope(parsed: unknown): parsed is ExportEnvelope<unknown> {
  return parsed != null && typeof parsed === 'object' && !Array.isArray(parsed)
}

/**
 * 解析导入用 JSON 文本
 * @param text JSON 文本
 * @returns 解析后的数据
 */
export function parseImportJsonText(text: string): unknown {
  const byteLength = new TextEncoder().encode(text).length
  if (byteLength > IMPORT_MAX_BYTES) {
    throw createImportError('fileTooLarge', { max: IMPORT_MAX_BYTES / 1024 / 1024 })
  }
  try {
    return JSON.parse(text)
  } catch {
    throw createImportError('invalidJson')
  }
}

/**
 * 解包 zterm 导出 envelope（仅支持 version 1）
 * @param parsed 解析后的数据
 * @param expectedKind 期望的导出类型
 * @returns 解包后的数据
 */
export function unwrapExportPayload(parsed: unknown, expectedKind: 'sessions'): unknown[]
export function unwrapExportPayload(parsed: unknown, expectedKind: 'settings'): Partial<AppSettings>
export function unwrapExportPayload(
  parsed: unknown,
  expectedKind: 'sessions' | 'settings',
): unknown[] | Partial<AppSettings> {
  if (!isExportEnvelope(parsed)) {
    throw createImportError('invalidPayload')
  }
  if (parsed.ztermExport !== expectedKind) {
    throw createImportError('wrongFileType', { kindKey: expectedKind })
  }
  if (parsed.version !== EXPORT_ENVELOPE_VERSION) {
    throw createImportError('unsupportedVersion', { version: EXPORT_ENVELOPE_VERSION })
  }
  const { data } = parsed
  if (expectedKind === 'sessions') {
    if (!Array.isArray(data)) throw createImportError('invalidPayload')
    return data
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw createImportError('invalidPayload')
  }
  return data as Partial<AppSettings>
}

/**
 * 构造导出 envelope
 * @param kind 导出类型
 * @param data 导出数据
 * @returns 导出 envelope
 */
export function buildExportEnvelope(
  kind: 'sessions' | 'settings',
  data: SavedSession[] | AppSettings,
): ExportEnvelope<SavedSession[] | AppSettings> {
  return {
    ztermExport: kind,
    version: EXPORT_ENVELOPE_VERSION,
    exportedAt: new Date().toString(),
    data,
  }
}
