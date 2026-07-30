import type { TranslateFn } from '../../types/common'
import type { SessionImportWarning } from '../../types/common'
import type { SavedSession } from '../../types/session'
import { validateAndParseSessionsImportContent } from './parseSessionsImport'
import { mergeImportedSessions } from './mergeImportedSessions'
import { formatSessionImportWarning } from '../session/importWarnings'

/** 重复会话警告代码集合 */
const DUPLICATE_SESSION_WARNING_CODES = new Set([
  'mergeDuplicateSavedId',
  'mergeDuplicateLabel',
])

/** 
 * 判断是否为重复会话警告
 * @param warning 警告
 * @returns 是否为重复会话警告
 */
function isDuplicateSessionWarning(warning: SessionImportWarning): boolean {
  return DUPLICATE_SESSION_WARNING_CODES.has(warning.code)
}

/**
 * 应用会话导入
 * @param content 导入的 JSON 文本
 * @param savedSessions 保存的会话
 * @param absorbSecrets 吸收明文凭据
 * @returns 应用后的会话、添加的会话数量和警告列表
 */
export async function applySessionsImportFromContent(
  content: string,
  savedSessions: SavedSession[],
  absorbSecrets: (sessions: SavedSession[]) => Promise<SavedSession[]>,
): Promise<{ sessions: SavedSession[]; addedCount: number; warnings: SessionImportWarning[] }> {
  const beforeCount = savedSessions.length
  const { sessions: imported, warnings: parseWarnings } = await validateAndParseSessionsImportContent(content)
  const mergeWarnings: SessionImportWarning[] = []
  const merged = mergeImportedSessions(savedSessions, imported, mergeWarnings)
  const sessions = await absorbSecrets(merged)
  return {
    sessions,
    addedCount: sessions.length - beforeCount,
    warnings: [...parseWarnings, ...mergeWarnings],
  }
}

/**
 * 报告会话导入结果
 * @param t 翻译函数
 * @param addedCount 添加的会话数量
 * @param warnings 导入警告列表
 */
export function reportSessionsImportResult(
  t: TranslateFn,
  { addedCount, warnings }: { addedCount: number; warnings: SessionImportWarning[] },
): void {
  const hasDuplicateWarnings = warnings.some(isDuplicateSessionWarning)
  const duplicateNote = hasDuplicateWarnings ? t('settings.importSessionsDuplicatesNote') : ''
  const otherWarnings = warnings.filter((w) => !isDuplicateSessionWarning(w))

  if (otherWarnings.length) {
    alert(t('settings.importSessionsPartial', {
      n: addedCount,
      duplicateNote,
      details: otherWarnings.map((w) => formatSessionImportWarning(t, w)).join('\n'),
    }))
  } else {
    alert(t('settings.importSessionsOk', { n: addedCount, duplicateNote }))
  }
}
