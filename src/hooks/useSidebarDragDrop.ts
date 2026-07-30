import { useRef, useState, useCallback, type DragEvent } from 'react'
import { uniqueLabelInGroup, vacatedNamedGroupIfEmpty } from '@/store/sessionStore'
import type { SavedSession } from '@/types/session'

/**
 * 使用侧边栏拖拽
 * @param savedSessions 保存的会话
 * @param groupPlaceholders 分组占位符
 * @param onUpdateSessions 更新会话回调
 * @param onUpdatePlaceholders 更新分组占位符回调
 * @returns 拖拽状态、开始拖拽、拖拽经过、拖拽离开、拖拽结束、是否在某个ID和拖拽区域、拖拽到分组、拖拽到会话、拖拽到无分组（根分组）区域
 */
export function useSidebarDragDrop(
  savedSessions: SavedSession[],
  groupPlaceholders: string[],
  onUpdateSessions: (
    sessions: SavedSession[],
    options?: { placeholderForVacatedGroup?: string },
  ) => void,
  onUpdatePlaceholders?: (placeholders: string[]) => void,
) {
  const [dragOver, setDragOver] = useState<{ id: string; zone: string } | null>(null)
  /** 被拖拽分组/会话的分组路径或者会话id和type（group/session） */
  const dragRef = useRef<{ id: string; type: string } | null>(null)

  /**
   * 开始拖拽
   * @param {Event} e 事件
   * @param {string} id 拖拽对象 ID
   * @param {string} type 拖拽对象类型，'session' 或 'group'
   */
  const dStart = (e: DragEvent, id: string, type: string) => {
    dragRef.current = { id, type }
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', id)
    e.stopPropagation()
  }

  /**
   * 拖拽经过
   * @param {Event} e 事件
   * @param {string} id 拖拽对象 ID
   * @param {string} zone 拖拽区域，'group' 或 'session' 或 'ungroup'
   */
  const dOver = (e: DragEvent, id: string, zone: string) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(prev => (prev?.id === id && prev?.zone === zone) ? prev : { id, zone })
  }

  /**
   * 拖拽离开
   * @param {Event} e 事件
   */
  const dLeave = (e: DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragOver(null)
  }

  /** 结束拖拽 */
  const dEnd = () => { dragRef.current = null; setDragOver(null) }

  /**
   * 当前被拖拽对象是否在某个ID和拖拽区域
   * @param {string} id 拖拽对象 ID
   * @param {string} zone 拖拽区域，'group' 或 'session' 或 'ungroup'
   */
  const isDO = (id: string, zone: string) => dragOver?.id === id && dragOver?.zone === zone

  /**
   * 收集所有分组路径
   * @returns {Set<string>} 所有分组路径集合
   */
  const collectAllGroupPaths = useCallback((): Set<string> => {
    const all = new Set<string>(groupPlaceholders as string[])  // 所有占位分组
    savedSessions.forEach(s => { if (s.group) all.add(s.group) })  // 所有会话的 group 路径
    return all  // 所有分组路径集合
  }, [groupPlaceholders, savedSessions])

  /**
   * 确保分组名称在父分组下唯一
   * @param {string} parentPath 父分组路径
   * @param {string} preferredName 首选名称
   * @param {string} movingGroupPath 移动中的分组路径
   * @returns {string} 唯一名称，如果首选名称已存在，则返回首选名称(1)、(2) 等后缀
   */
  const uniqueGroupNameUnder = useCallback((parentPath: string, preferredName: string, movingGroupPath: string) => {
    const used = new Set<string>()
    for (const p of collectAllGroupPaths()) {
      if (p === movingGroupPath || p.startsWith(movingGroupPath + '/')) continue
      if (parentPath) {
        if (!p.startsWith(parentPath + '/')) continue
        const rest = p.slice(parentPath.length + 1)
        const child = rest.split('/')[0]
        if (child) used.add(child)
      } else {
        const child = p.split('/')[0]
        if (child) used.add(child)
      }
    }
    if (!used.has(preferredName)) return preferredName
    let i = 1
    while (used.has(`${preferredName}(${i})`)) i++
    return `${preferredName}(${i})`
  }, [collectAllGroupPaths])

  /**
   * 拖拽到分组
   * @param {Event} e 事件
   * @param {string} groupPath 目标分组路径
   */
  const dropOnGroup = (e: DragEvent, groupPath: string) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(null)
    const src = dragRef.current
    if (!src) return
    if (src.type === 'session') {  // 会话拖拽到分组，检查是否有同名会话
      const movedSession = savedSessions.find(s => s.savedId === src.id)
      if (!movedSession) return
      const siblings = savedSessions.filter(s => (s.group || '') === groupPath && s.savedId !== src.id)
      const used = new Set(siblings.map(s => s.label))
      let newLabel = movedSession.label
      if (used.has(newLabel)) {
        let i = 1
        while (used.has(`${movedSession.label}(${i})`)) i++
        newLabel = `${movedSession.label}(${i})`
      }
      const next = savedSessions.map(s =>
        s.savedId === src.id ? { ...s, group: groupPath, label: newLabel } : s
      )  // 更新会话的 group 路径和标签名
      const v = vacatedNamedGroupIfEmpty(movedSession.group, next)
      onUpdateSessions(next, v ? { placeholderForVacatedGroup: v } : undefined)  // 更新会话列表，如果需要恢复为占位分组，则设置占位分组
    } else if (src.type === 'group' && src.id !== groupPath && !groupPath.startsWith(src.id + '/')) {  // 分组拖拽到分组，检查是否有同名分组
      const oldPath = src.id  // 获取源分组路径
      const preferredName = oldPath.split('/').pop()  // 获取源分组名称
      const targetName = uniqueGroupNameUnder(groupPath, preferredName ?? '', oldPath)  // 确保目标分组名称在父分组下唯一
      const newPath = groupPath + '/' + targetName
      onUpdateSessions(savedSessions.map(s =>
        s.group === oldPath ? { ...s, group: newPath } :
        s.group?.startsWith(oldPath + '/') ? { ...s, group: newPath + s.group.slice(oldPath.length) } : s
      ))
      onUpdatePlaceholders?.(Array.from(new Set(groupPlaceholders.map(g =>
        g === oldPath ? newPath :
        g.startsWith(oldPath + '/') ? newPath + g.slice(oldPath.length) : g
      ))))  // 更新占位分组（用于下次新增分组时自动补全）
    }
    dragRef.current = null
  }

  /**
   * 拖拽到会话
   * @param {Event} e 事件
   * @param {string} sessId 目标会话 ID
   * @param {string} groupPath 目标会话所属分组路径
   */
  const dropOnSession = (e: DragEvent, sessId: string, groupPath: string) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(null)
    const src = dragRef.current
    if (!src || src.type !== 'session' || src.id === sessId) return
    const arr = savedSessions.slice()
    const fi = arr.findIndex(s => s.savedId === src.id)
    const ti = arr.findIndex(s => s.savedId === sessId)
    if (fi < 0 || ti < 0) return
    const [item] = arr.splice(fi, 1)
    const movedItem = { ...item, group: groupPath }
    const siblings = arr.filter(s => (s.group || '') === groupPath)
    const used = new Set(siblings.map(s => s.label))
    if (used.has(movedItem.label)) {
      let i = 1
      while (used.has(`${movedItem.label}(${i})`)) i++
      movedItem.label = `${movedItem.label}(${i})`
    }
    arr.splice(ti, 0, movedItem)
    const v = vacatedNamedGroupIfEmpty(item.group, arr)
    onUpdateSessions(arr, v ? { placeholderForVacatedGroup: v } : undefined)
    dragRef.current = null
  }

  /**
   * 拖拽到无分组（根分组）区域
   * @param {Event} e 事件
   */
  const dropUngroup = (e: DragEvent) => {
    e.preventDefault()
    setDragOver(null)
    const src = dragRef.current
    if (!src) return
    if (src.type === 'session') {
      const movedSession = savedSessions.find(s => s.savedId === src.id)
      if (!movedSession) { dragRef.current = null; return }
      const interim = savedSessions.map(s => s.savedId === src.id ? { ...s, group: '' } : s)
      const newLabel = uniqueLabelInGroup(interim, '', movedSession.label, src.id)
      const next = savedSessions.map(s => s.savedId === src.id ? { ...s, group: '', label: newLabel } : s)
      const v = vacatedNamedGroupIfEmpty(movedSession.group, next)
      onUpdateSessions(next, v ? { placeholderForVacatedGroup: v } : undefined)  // 更新会话列表，如果需要恢复为占位分组，则设置占位分组
    } else if (src.type === 'group') {  // 拖的是分组
      const oldPath = src.id
      const preferredName = oldPath.split('/').pop()  // 获取源分组名称
      const targetName = uniqueGroupNameUnder('', preferredName ?? '', oldPath)  // 确保目标分组名称在父分组下唯一
      const newPath = targetName
      onUpdateSessions(savedSessions.map(s =>
        s.group === oldPath ? { ...s, group: newPath } :
        s.group?.startsWith(oldPath + '/') ? { ...s, group: newPath + s.group.slice(oldPath.length) } : s
      ))
      onUpdatePlaceholders?.(Array.from(new Set(groupPlaceholders.map(g =>
        g === oldPath ? newPath :
        g.startsWith(oldPath + '/') ? newPath + g.slice(oldPath.length) : g
      ))))
    }
    dragRef.current = null
  }

  return {
    dragOver,
    dStart,
    dOver,
    dLeave,
    dEnd,
    isDO,
    dropOnGroup,
    dropOnSession,
    dropUngroup,
  }
}
