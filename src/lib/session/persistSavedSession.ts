import type { SavedSession, SessionConfig } from '../../types/session'
import { addSavedSession, vacatedGroupIfMoved } from '../../store/sessionStore'

/**
 * 编辑已保存会话后，若原分组路径上已无任何会话，返回该路径以便添加占位分组
 * @param savedSessions 当前已保存列表
 * @param config 本次提交的配置（含 group）
 * @param before 保存前的会话对象（新建时为 null）
 * @returns next 更新后的列表；vacated 需恢复为占位符的分组路径（不需要则 undefined）
 */
export function prepareSavedSessionUpdate(
  savedSessions: SavedSession[],
  config: SessionConfig,
  before: SavedSession | null | undefined,
) {
  const next = addSavedSession(savedSessions, config)
  const vacated = vacatedGroupIfMoved(before?.group, config.group, next)
  return { next, vacated }
}
