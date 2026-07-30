import { createImportError } from './handleImportErrors'
import { parseImportJsonText, unwrapExportPayload } from './parseImportFile'
import { normalizeImportedSession } from '../session/normalizeSession'
import type { SessionImportWarning } from '../../types/common'
import type { SavedSession } from '../../types/session'
import { IMPORT_MAX_SESSION_COUNT } from './constants'

/**
 * 验证并解析会话导入 JSON 文本
 * @param content 导入的 JSON 文本
 * @returns 解析后的会话列表、统计信息和导入警告列表
 */
export async function validateAndParseSessionsImportContent(content: string) {
  const parsed = parseImportJsonText(content)
  const rows = unwrapExportPayload(parsed, 'sessions')
  if (rows.length > IMPORT_MAX_SESSION_COUNT) {
    throw createImportError('tooManySessions', { max: IMPORT_MAX_SESSION_COUNT })
  }

  const sessions: SavedSession[] = []
  let skipped = 0
  const warnings: SessionImportWarning[] = []

  rows.forEach((raw: unknown, index: number) => {
    const oneBased = index + 1
    const result = normalizeImportedSession(raw)
    if (result.ok) {
      sessions.push(result.session)
      for (const w of result.warnings) {
        warnings.push({
          code: w.code,
          params: { index: oneBased, ...(w.params || {}) },
        })
      }
    } else {
      skipped += 1
      warnings.push({
        code: 'sessionSkipped',
        params: { index: oneBased, reason: result.reason },
      })
    }
  })

  const stats = { total: rows.length, accepted: sessions.length, skipped }
  if (sessions.length === 0) {
    throw createImportError('noValidSessions', { skipped })
  }

  return { sessions, stats, warnings }
}
