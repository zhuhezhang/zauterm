import type { SavedSession } from '../../types/session'
import type { SessionImportWarning } from '../../types/common'

/**
 * 判断两个会话是否具有相同的标签和分组
 * @param a 会话
 * @param b 会话
 * @returns 是否具有相同的标签和分组
 */
function isSameLabelAndGroup(a: SavedSession, b: SavedSession): boolean {
  return String(a.label ?? '') === String(b.label ?? '') && String(a.group ?? '').trim() === String(b.group ?? '').trim()
}

/**
 * 合并导入的会话
 * @param existing 现有的会话
 * @param imported 导入的会话
 * @param warnings 警告列表
 * @returns 合并后的会话
 */
export function mergeImportedSessions(
  existing: SavedSession[],
  imported: SavedSession[],
  warnings: SessionImportWarning[],
): SavedSession[] {
  const merged: SavedSession[] = [...existing]
  imported.forEach((s, index) => {
    const oneBased = index + 1
    const savedId = String(s.savedId ?? '')
    const label = String(s.label ?? '')
    const group = String(s.group ?? '').trim()

    if (merged.some((m) => m.savedId === savedId)) {
      warnings.push({ code: 'mergeDuplicateSavedId', params: {
        index: oneBased,
        savedId,
        label,
      }})
      return
    }

    if (merged.some((m) => isSameLabelAndGroup(m, s))) {
      warnings.push({ code: 'mergeDuplicateLabel', params: {
        index: oneBased,
        savedId,
        label,
        group,
      }})
      return
    }

    merged.push(s)
  })

  return merged
}
