import {
  useState, useRef, useEffect, useLayoutEffect, useMemo, useCallback, lazy, Suspense, memo,
  type KeyboardEvent, type MouseEvent,
} from 'react'
import { useI18n } from '@/context/I18nContext'
import { useDismissOnOutsideClick } from '@/hooks/useDismissOnOutsideClick'
import { useDismissOnEscape } from '@/hooks/useDismissOnEscape'
import { useSessionsImport } from '@/hooks/useSessionsImport'
import { useSidebarDragDrop } from '@/hooks/useSidebarDragDrop'
import { uniqueLabelInGroup, ungroupSessionsUnderPath } from '@/store/sessionStore'
import { buildTree, flattenVisibleTree, NO_GROUP_PLACEHOLDERS } from '@/lib/session/tree'
import { sessionEndpoint } from '@/types/session'
import { hasInvalidLabelChars } from '@/lib/safeFileName'
import { revealAndFocusSessionSearch } from '@/lib/sessionSearchFocus'

const SftpPanel = lazy(() => import('../SftpPanel'))
import { Chevron, FolderIcon } from './icons'
import SidebarTop from './SidebarTop'
import SessionTreeNodeView from './SessionTreeNode'
import SidebarContextMenu from './SidebarContextMenu'
import type { SidebarContextMenuState, SidebarProps } from '@/types/components'
import type { SessionTreeNode as TreeNode } from '@/types/session'
import '@/styles/sidebar.css'

/** 侧边栏组件（使用 memo 记忆化渲染） */
export default memo(function Sidebar(props: SidebarProps) {
  const {
    open, onToggle, savedSessions, onNewSession, onConnectSaved, onDeleteSaved, onUpdateSessions,
    onDuplicateSaved = () => {},
    activeSession, settings, onOpenSettings, style, groupPlaceholders = [], onUpdatePlaceholders,
    focusSessionSearchNonce = 0,
  } = props

  const { t } = useI18n()
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})  // 展开状态，key 是分组路径，value 是是否展开
  const [sessionsCollapsed, setSessionsCollapsed] = useState(false)  // 会话是否收起
  const [contextMenu, setContextMenu] = useState<SidebarContextMenuState | null>(null)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [renameVal, setRenameVal] = useState('')
  const [renamingSession, setRenamingSession] = useState<string | null>(null)
  const [renameSessionVal, setRenameSessionVal] = useState('')  // 重命名会话输入值
  const [sftpExpanded, setSftpExpanded] = useState(true)  // SFTP 是否展开
  const [sessionSearchQuery, setSessionSearchQuery] = useState('')  // 会话搜索查询(按会话名、主机或串口路径搜索已保存会话)
  const [keyboardFocusId, setKeyboardFocusId] = useState<string | null>(null)
  const {
    dStart, dOver, dLeave, dEnd, isDO, dropOnGroup, dropOnSession, dropUngroup,
  } = useSidebarDragDrop(savedSessions, groupPlaceholders, onUpdateSessions, onUpdatePlaceholders)
  const { triggerImport } = useSessionsImport(
    savedSessions,
    onUpdateSessions,
  )
  const renameGroupInputRef = useRef<HTMLInputElement | null>(null)
  const renameGroupAlertingRef = useRef(false)
  const ignoreRenameGroupBlurRef = useRef(false)
  const sessionSearchInputRef = useRef<HTMLInputElement | null>(null)
  const renameSessionInputRef = useRef<HTMLInputElement | null>(null)
  const renameSessionAlertingRef = useRef(false)
  const ignoreRenameSessionBlurRef = useRef(false)
  const expandedBeforeSearchRef = useRef<Record<string, boolean> | null>(null)
  /** 已处理过的 focusSessionSearchNonce，避免用户手动收起/展开时重复触发聚焦 */
  const lastHandledFocusNonceRef = useRef(0)
  /** 当前分组展开状态快照，用于搜索框方向键选中树项时滚动到该树项所在位置 */
  const expandedRef = useRef(expanded)
  expandedRef.current = expanded

  /**
   * 是否展开
   * @param path 分组路径
   * @returns 是否展开
   */
  const isExp = (path: string) => expanded[path] === true
  const togExp = (path: string) => setExpanded((p) => ({ ...p, [path]: !isExp(path) }))
  /** 清除搜索框方向键对分组/会话的高亮选中 */
  const clearKeyboardFocus = useCallback(() => setKeyboardFocusId(null), [])

  /**
   * 更新会话搜索词；进入搜索时快照分组展开状态，结束搜索时恢复
   * @param next 新的搜索框内容
   */
  const updateSessionSearchQuery = useCallback((next: string) => {
    const nextTrim = String(next).trim()
    const prevTrim = sessionSearchQuery.trim()
    if (!prevTrim && nextTrim) {
      expandedBeforeSearchRef.current = { ...expandedRef.current }
    }
    if (prevTrim && !nextTrim && expandedBeforeSearchRef.current) {
      setExpanded(expandedBeforeSearchRef.current)
      expandedBeforeSearchRef.current = null
    }
    setSessionSearchQuery(next)
    setKeyboardFocusId(null)
  }, [sessionSearchQuery])
  /**
   * 打开上下文菜单
   * @param e 事件
   * @param type 类型
   * @param data 数据
   */
  const openCtx = (e: MouseEvent, type: SidebarContextMenuState['type'], data: SidebarContextMenuState['data']) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY, type, data } as SidebarContextMenuState)
  }
  /** 关闭上下文菜单 */
  const closeCtx = () => setContextMenu(null)

  useDismissOnOutsideClick(!!contextMenu, closeCtx, '.context-menu')
  useDismissOnEscape(!!contextMenu, closeCtx)

  /** 展开所有分组 */
  const expandAll = () => {
    const all: Record<string, boolean> = {}
    const collectGroups = (nodes: TreeNode[]) => nodes.forEach((n) => {
      if (n.type === 'group') { all[n.path] = true; collectGroups(n.children) }
    })
    collectGroups(buildTree(savedSessions, groupPlaceholders))  // 收集所有分组路径
    setExpanded(all)  // 设置展开状态
    setSessionsCollapsed(false)  // 设置会话不收起
  }
  /** 收起所有分组 */
  const collapseAll = () => {
    setExpanded({})  // 设置展开状态为空
    setSessionsCollapsed(false)  // 设置会话不收起
  }

  /** 
   * 展开该分组所有子项
   * @param groupPath 分组路径
   */
  const expandGroupAll = (groupPath: string) => {
    const all: Record<string, boolean> = {}
    const collectGroups = (nodes: TreeNode[]) => nodes.forEach((n) => {
      if (n.type === 'group') { all[n.path] = true; collectGroups(n.children) }
    })
    const walk = (nodes: TreeNode[]): boolean => {
      for (const n of nodes) {
        if (n.type !== 'group') continue
        if (n.path === groupPath) {  // 如果当前分组是目标分组，收集该分组及其子项
          collectGroups([n])
          return true
        }
        if (walk(n.children)) return true  // 递归收集子项
      }
      return false
    }
    walk(buildTree(savedSessions, groupPlaceholders))
    setExpanded(prev => ({ ...prev, ...all }))  // 设置展开状态
    setSessionsCollapsed(false)
  }

  /** 
   * 收起该分组所有子项
   * @param groupPath 分组路径
   */
  const collapseGroupAll = (groupPath: string) => {
    setExpanded(prev => {
      const next = { ...prev }
      Object.keys(next).forEach(k => {
        if (k === groupPath || k.startsWith(groupPath + '/')) next[k] = false
      })
      return next
    })
  }

  /** 
   * 重命名分组
   * @param oldPath 旧路径
   * @param newName 新名称
   */
  const renameGroup = (oldPath: string, newName: string) => {
    const trimmed = newName.trim()
    if (!trimmed) { setRenaming(null); return }  // 如果新名称是空，取消编辑，不做任何重命名（也不弹提示）
    if (hasInvalidLabelChars(trimmed)) {  // 非法字符校验 + 弹窗后重新聚焦输入框
      if (renameGroupAlertingRef.current) return
      renameGroupAlertingRef.current = true  // 设置警告状态，避免 alert 触发的事件链（blur/focus）导致重复弹窗
      ignoreRenameGroupBlurRef.current = true  // 设置忽略 blur 状态（blur 事件也就是失去焦点事件）
      alert(t('sidebar.renameGroupInvalid'))
      renameGroupAlertingRef.current = false
      setTimeout(() => {  // 等当前调用栈结束后再 focus()，确保浏览器/React 状态稳定，焦点能正确回到输入框
        renameGroupInputRef.current?.focus()
        ignoreRenameGroupBlurRef.current = false
      }, 0)
      return
    }

    const oldName = oldPath.split('/').pop()
    if (trimmed === oldName) { setRenaming(null); return }  // 如果新名称与旧名称相同，取消编辑，不做任何重命名
    const parts = oldPath.split('/')  // 计算父路径（用于“同级”冲突检测）
    const parentPath = parts.length > 1 ? parts.slice(0, -1).join('/') : ''  // 若 oldPath = "B/A"，父路径是 "B"；若 oldPath = "A"，父路径是空（代表根）
    const usedSiblingNames = new Set()  // 同父分组下的所有子分组名字（不含自己这棵树）
    const all = new Set([...groupPlaceholders, ...savedSessions.map(s => s.group).filter(Boolean)])  // 所有占位分组和会话的已用分组名称集合
    for (const p of all) {  // 遍历所有已用分组名称，检查是否与新名称冲突
      if (p === oldPath || p.startsWith(oldPath + '/')) continue  // 如果 p 是 oldPath 或 oldPath 的子路径，跳过
      if (parentPath) {  // 如果父路径存在（非根分组）
        if (!p.startsWith(parentPath + '/')) continue  // 只关心同一个父分组下面的路径
        const rest = p.slice(parentPath.length + 1)  // 取父分组下第一段，得到“同级分组名”：例：p="B/A/xx" → rest="A/xx" → child="A"
        const child = rest.split('/')[0]
        if (child) usedSiblingNames.add(child)  // 如果子名称存在，添加到集合中
      } else {  // 如果父路径不存在（根分组），获取所有分组路径下的根分组下的子分组名称
        const child = p.split('/')[0]
        if (child) usedSiblingNames.add(child)
      }
    }

    let uniqueName = trimmed
    if (usedSiblingNames.has(uniqueName)) {  // 如果新名称与已用名称冲突，则自动添加 (1)、(2) 等后缀
      let i = 1
      while (usedSiblingNames.has(`${trimmed}(${i})`)) i++
      uniqueName = `${trimmed}(${i})`
    }
    parts[parts.length - 1] = uniqueName
    const newPath = parts.join('/')  // 构建新的分组路径
    onUpdateSessions(savedSessions.map(s =>
      s.group === oldPath ? { ...s, group: newPath } :
      s.group?.startsWith(oldPath + '/') ? { ...s, group: newPath + s.group.slice(oldPath.length) } : s
    ))  // 批量更新所有会话的 group 路径（包含子树）
    onUpdatePlaceholders?.(groupPlaceholders.map(g =>
      g === oldPath ? newPath : g.startsWith(oldPath + '/') ? newPath + g.slice(oldPath.length) : g
    ))  // 更新占位分组（用于下次新增分组时自动补全）
    setRenaming(null)  // 清掉“当前正在重命名哪个分组”的状态，UI 回到正常显示
  }

  /** 
   * 删除分组
   * @param path 分组路径
   */
  const deleteGroup = (path: string) => {
    const w = settings?.deleteGroupWithSessions  // 是否删除分组时连带删除其下的所有会话
    const name = path.split('/').pop()  // 获取分组名称
    const msg = w ? t('sidebar.deleteGroupWithKids', { name: name ?? path }) : t('sidebar.deleteGroupOnly', { name: name ?? path })
    if (settings?.confirmDeleteGroup !== false && !confirm(msg)) return  // 如果配置了不确认删除，则不删除
    if (w)  // 如果配置了删除分组时连带删除其下的所有会话，则删除所有会话
      onUpdateSessions(savedSessions.filter(s => s.group !== path && !s.group?.startsWith(path + '/')))
    else // 不删除会话：移为未分组，并与已有未分组会话去重标签名
      onUpdateSessions(ungroupSessionsUnderPath(savedSessions, path))
    onUpdatePlaceholders?.(groupPlaceholders.filter(g => g !== path && !g.startsWith(path + '/')))  // 更新占位分组（用于下次新增分组时自动补全）
  }

  /** 
   * 删除会话
   * @param id 会话 ID
   * @param label 会话名称
   */
  const deleteSession = (id: string, label: string) => {
    if (settings?.confirmDeleteSession !== false && !confirm(t('sidebar.deleteSession', { label }))) return  // 如果配置了不确认删除，则不删除
    onDeleteSaved(id)
  }

  /** 
   * 复制会话
   * @param id 要复制的会话 ID
   */
  const dupSession = (id: string) => onDuplicateSaved(id)

  /** 
   * 重命名会话
   * @param savedId 要重命名的会话的savedId 会话 ID
   * @param newLabel 新名称
   */
  const renameSession = (savedId: string, newLabel: string) => {
    const trimmed = newLabel.trim()
    if (!trimmed) {
      setRenamingSession(null)  // 空标签：恢复原标签，不做任何重命名（也不弹提示）
      return
    }
    if (hasInvalidLabelChars(trimmed)) {  // 非法字符校验 + 弹窗后重新聚焦输入框
      if (renameSessionAlertingRef.current) return
      renameSessionAlertingRef.current = true  // 设置警告状态，避免 alert 触发的事件链（blur/focus）导致重复弹窗
      ignoreRenameSessionBlurRef.current = true  // 设置忽略 blur 状态（blur 事件也就是失去焦点事件）
      alert(t('sidebar.renameSessionInvalid'))
      renameSessionAlertingRef.current = false  // 设置警告状态为 false，避免重复弹窗
      setTimeout(() => {  // 等当前调用栈结束后再 focus()，确保浏览器/React 状态稳定，焦点能正确回到输入框
        renameSessionInputRef.current?.focus()
        ignoreRenameSessionBlurRef.current = false
      }, 0)
      return
    }
    const target = savedSessions.find(s => s.savedId === savedId)
    if (!target || trimmed === target.label) { setRenamingSession(null); return }
    const uniqueLabel = uniqueLabelInGroup(savedSessions, target.group, trimmed, savedId)  // 使用 uniqueLabelInGroup 确保唯一性
    onUpdateSessions(savedSessions.map(s => s.savedId === savedId ? { ...s, label: uniqueLabel } : s))
    setRenamingSession(null)
  }

  /** 搜索查询的 trimmed 版本 */
  const searchTrim = sessionSearchQuery.trim()
  /** 搜索查询的 lowercased 版本 */
  const searchLower = searchTrim.toLowerCase()
  /** 按保存的会话名（及主机）筛选侧边栏列表。 useMemo：记忆化计算，缓存结果，避免重复计算。当savedSessions/searchLower变化时重新计算 */
  const filteredSavedSessions = useMemo(() => {  // useMemo：记忆化计算，缓存结果，避免重复计算。当savedSessions/searchLower变化时重新计算
    if (!searchLower) return savedSessions
    return savedSessions.filter((s) => {
      const label = (s.label || '').toLowerCase()
      const endpoint = sessionEndpoint(s).toLowerCase()
      return label.includes(searchLower) || endpoint.includes(searchLower)
    })
  }, [savedSessions, searchLower])

  /** 搜索时 buildTree 不注入占位分组，避免无匹配会话下出现空分组树 */
  const treePlaceholders = searchTrim ? NO_GROUP_PLACEHOLDERS : groupPlaceholders

  /** 构建会话树结构，支持分组和未分组会话 */
  const tree = useMemo(
    () => buildTree(filteredSavedSessions, treePlaceholders),
    [filteredSavedSessions, treePlaceholders],
  )

  /** 搜索框方向键可遍历的可见树项（随展开/筛选变化） */
  const visibleTreeItems = useMemo(() => flattenVisibleTree(tree, isExp), [tree, expanded])

  useEffect(() => {  // 搜索框方向键选中树项时，如果该树项不在可见范围内，则清除高亮选中
    if (keyboardFocusId && !visibleTreeItems.some((i) => i.id === keyboardFocusId)) {
      setKeyboardFocusId(null)
    }
  }, [visibleTreeItems, keyboardFocusId])

  useEffect(() => {  // 搜索框方向键选中树项时，滚动到该树项所在位置
    if (!keyboardFocusId || sessionsCollapsed) return
    const el = document.querySelector(`.sb-tree [data-tree-id="${CSS.escape(keyboardFocusId)}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [keyboardFocusId, sessionsCollapsed, visibleTreeItems])

  /** 搜索框键盘：方向键选中树项，回车连接/展开；无选中且搜索非空时回车新建连接 */
  const handleSessionSearchKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (visibleTreeItems.length === 0) return
      e.preventDefault()
      const len = visibleTreeItems.length
      const curIdx = keyboardFocusId == null
        ? -1
        : visibleTreeItems.findIndex((i) => i.id === keyboardFocusId)
      const nextIdx = e.key === 'ArrowDown'
        ? (curIdx < 0 ? 0 : (curIdx + 1) % len)
        : (curIdx < 0 ? len - 1 : (curIdx - 1 + len) % len)
      setKeyboardFocusId(visibleTreeItems[nextIdx].id)
      return
    }
    if (e.key !== 'Enter') return
    const focused = visibleTreeItems.find((i) => i.id === keyboardFocusId)
    if (focused) {
      e.preventDefault()
      if (focused.type === 'group' && focused.node.type === 'group') togExp(focused.node.path)
      else if (focused.node.type === 'session') onConnectSaved(focused.node.session)
      return
    }
    if (!searchTrim) return
    e.preventDefault()
    onNewSession('ssh', { host: searchTrim })
  }, [visibleTreeItems, keyboardFocusId, searchTrim, togExp, onConnectSaved, onNewSession])

  useLayoutEffect(() => {  // 全局 Cmd/Ctrl+F：先展开「保存的会话」，再滚入可见区域并聚焦搜索框。 useLayoutEffect：在 DOM 更新完成后且参数列表变化时同步执行，确保在浏览器绘制前完成滚动和聚焦，避免视觉上的闪烁
    if (!focusSessionSearchNonce || !open) return
    if (focusSessionSearchNonce === lastHandledFocusNonceRef.current) return
    if (sessionsCollapsed) {
      setSessionsCollapsed(false)
      return
    }
    lastHandledFocusNonceRef.current = focusSessionSearchNonce
    return revealAndFocusSessionSearch(() => sessionSearchInputRef.current)
  }, [focusSessionSearchNonce, open, sessionsCollapsed])

  useEffect(() => {  // 有筛选关键词时自动展开匹配会话所在分组
    if (!searchTrim) return
    const paths = new Set<string>()
    for (const s of filteredSavedSessions) {
      if (!s.group) continue
      let acc = ''
      for (const seg of s.group.split('/')) {
        acc = acc ? `${acc}/${seg}` : seg
        paths.add(acc)
      }
    }
    if (paths.size === 0) return
    setExpanded((prev) => {
      const next = { ...prev }
      for (const p of paths) next[p] = true
      return next
    })
  }, [searchTrim, filteredSavedSessions])

  /** 是否有 SFTP 面板。 !!(...) 把结果强制转换成布尔值 */
  const hasSftp = !!activeSession?.sftpReady

  return (
    <div className={`sidebar ${open ? 'open' : 'closed'}`} style={open ? style : undefined} onClick={closeCtx}>
      <SidebarTop open={open} onToggle={onToggle} onOpenSettings={onOpenSettings} t={t} />
      {open && (
        <div className="sidebar-content">
          {hasSftp && (
            <div className="sidebar-sftp-section">
              <div className="sb-section-row" onClick={() => setSftpExpanded(v => !v)}>
                <span className={`sb-chevron${sftpExpanded ? ' open' : ''}`}><Chevron /></span>
                <span className="sftp-item-icon">📁</span>
                <span className="sb-section-label">{t('sidebar.remoteFiles')}</span>
              </div>
              {sftpExpanded && (
                <Suspense fallback={null}>
                  <SftpPanel session={activeSession} />
                </Suspense>
              )}
            </div>
          )}
          <div className={`sb-sessions-scroll${keyboardFocusId ? ' sb-keyboard-nav' : ''}`}>
            <div className={`sb-section-row sessions-header${isDO('__sessions_header__', 'drop') ? ' drop-target' : ''}${contextMenu?.type === 'sessions-header' ? ' sb-context-target' : ''}`}
              onMouseEnter={clearKeyboardFocus}
              onClick={() => setSessionsCollapsed(v => !v)}
              onContextMenu={e => openCtx(e, 'sessions-header', null)}
              onDragOver={e => dOver(e, '__sessions_header__', 'drop')}
              onDragLeave={dLeave}
              onDrop={dropUngroup}>
              <span className={`sb-chevron${sessionsCollapsed ? '' : ' open'}`}><Chevron /></span>
              <span className="sftp-item-icon sb-folder-icon" style={{ color: !sessionsCollapsed ? '#e8bf6a' : '#c4a35a' }}><FolderIcon open={open} /></span>
              <span className="sb-section-label">{t('sidebar.savedSessions')}</span>
            </div>
            {!sessionsCollapsed && (
              <>
                <div className="sb-session-search-wrap">
                  <input
                    ref={sessionSearchInputRef}
                    type="search"
                    className="sb-session-search"
                    placeholder={t('sidebar.searchPh')}
                    value={sessionSearchQuery}
                    onChange={(e) => updateSessionSearchQuery(e.target.value)}
                    onKeyDown={handleSessionSearchKeyDown}
                    onBlur={clearKeyboardFocus}
                    aria-label={t('sidebar.searchAria')}
                  />
                </div>
                <div
                  className={`sb-tree${isDO('__root__', 'drop') ? ' drop-target' : ''}`}
                  onMouseEnter={clearKeyboardFocus}
                  onDragOver={e => dOver(e, '__root__', 'drop')}
                  onDragLeave={dLeave}
                  onDrop={dropUngroup}>
                {tree.length === 0 && (
                  <div className="sb-empty">
                    {savedSessions.length === 0 ? (
                      <>
                        <span>{t('sidebar.noSaved')}</span>
                        <button type="button" className="sb-link" onClick={() => onNewSession('ssh')}>{t('sidebar.newConnection')}</button>
                        <button type="button" className="sb-link" onClick={triggerImport}>{t('settings.importSessions')}</button>
                      </>
                    ) : searchTrim ? (
                      <>
                        <span>{t('sidebar.noMatch')}</span>
                        <button type="button" className="sb-link" onClick={() => onNewSession('ssh', { host: searchTrim })}>{t('sidebar.newConnection')}</button>
                        <button type="button" className="sb-link" onClick={() => updateSessionSearchQuery('')}>{t('sidebar.clearSearch')}</button>
                      </>
                    ) : (
                      <span>{t('sidebar.nothingToShow')}</span>
                    )}
                  </div>
                )}
                {tree.map(node => (
                  <SessionTreeNodeView key={node.id} node={node} depth={0}
                    keyboardFocusId={keyboardFocusId}
                    contextMenu={contextMenu}
                    isExp={isExp} togExp={togExp} openCtx={openCtx} onConnectSaved={onConnectSaved}
                    renaming={renaming} renameVal={renameVal} setRenameVal={setRenameVal}
                    setRenaming={setRenaming} renameGroup={renameGroup}
                    renameGroupInputRef={renameGroupInputRef} ignoreRenameGroupBlurRef={ignoreRenameGroupBlurRef}
                    renamingSession={renamingSession} renameSessionVal={renameSessionVal}
                    setRenamingSession={setRenamingSession} setRenameSessionVal={setRenameSessionVal}
                    renameSession={renameSession} renameSessionInputRef={renameSessionInputRef}
                    ignoreRenameSessionBlurRef={ignoreRenameSessionBlurRef}
                    dStart={dStart} dEnd={dEnd} dOver={dOver} dLeave={dLeave}
                    dropOnGroup={dropOnGroup} dropOnSession={dropOnSession} isDO={isDO}
                  />
                ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {contextMenu && (
        <SidebarContextMenu ctx={contextMenu} closeCtx={closeCtx}
          onConnectSaved={onConnectSaved} onNewSession={onNewSession}
          dupSession={dupSession} deleteSession={deleteSession} deleteGroup={deleteGroup}
          setRenaming={setRenaming} setRenameVal={setRenameVal}
          groupPlaceholders={groupPlaceholders} onUpdatePlaceholders={onUpdatePlaceholders}
          expandAll={expandAll} collapseAll={collapseAll}
          expandGroupAll={expandGroupAll} collapseGroupAll={collapseGroupAll}
          setRenamingSession={setRenamingSession} setRenameSessionVal={setRenameSessionVal}
          savedSessions={savedSessions}
          onImportSessions={() => { void triggerImport() }}
        />
      )}
    </div>
  )
})
