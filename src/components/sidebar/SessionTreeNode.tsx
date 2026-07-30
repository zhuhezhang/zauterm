import type { SessionType } from '@/types/session'
import { sessionEndpoint, sessionHasSftp } from '@/types/session'
import type { SessionTreeNodeComponentProps } from '@/types/components'
import { ConnectionTypeIcon } from '../common'
import { Chevron, FolderIcon, TYPE_COLORS } from './icons'

/** 会话树节点组件：显示分组或会话的树节点，支持重命名、拖拽、上下文菜单等操作 */
export default function SessionTreeNode({
  node, depth, keyboardFocusId, contextMenu, isExp, togExp, openCtx, onConnectSaved,
  renaming, renameVal, setRenameVal, setRenaming, renameGroup,
  renameGroupInputRef, ignoreRenameGroupBlurRef,
  renamingSession, renameSessionVal, setRenamingSession, setRenameSessionVal, renameSession, renameSessionInputRef,
  ignoreRenameSessionBlurRef,
  dStart, dEnd, dOver, dLeave, dropOnGroup, dropOnSession, isDO,
}: SessionTreeNodeComponentProps) {
  const indent = depth * 14 + 14
  const isKbFocused = keyboardFocusId === node.id
  if (node.type === 'group') {
    const open = isExp(node.path)  // 是否展开
    const isDropTarget = isDO(node.id, 'group')  // 是否是拖拽目标
    const isCtxTarget = contextMenu?.type === 'group' && contextMenu.data === node.path
    return (
      <div className="sb-node-group">
        <div
          className={`sb-row sb-folder-row${isDropTarget ? ' drop-target' : ''}${isKbFocused ? ' sb-keyboard-focus' : ''}${isCtxTarget ? ' sb-context-target' : ''}`}
          data-tree-id={node.id}
          style={{ paddingLeft: indent }}
          onClick={() => togExp(node.path)}
          onContextMenu={e => openCtx(e, 'group', node.path)}
          draggable
          onDragStart={e => dStart(e, node.id, 'group')}
          onDragEnd={dEnd}
          onDragOver={e => dOver(e, node.id, 'group')}
          onDragLeave={dLeave}
          onDrop={e => dropOnGroup(e, node.path)}>
          <span className={`sb-chevron${open ? ' open' : ''}`}><Chevron /></span>
          <span className="sb-folder-icon" style={{ color: open ? '#e8bf6a' : '#c4a35a' }}><FolderIcon open={open} /></span>
          {renaming === node.path ? (
            <input className="sb-rename-input" value={renameVal} autoFocus ref={renameGroupInputRef}
              onClick={e => e.stopPropagation()}
              onChange={e => setRenameVal(e.target.value)}
              onBlur={() => {
                if (ignoreRenameGroupBlurRef.current) return
                renameGroup(node.path, renameVal)
              }}
              onKeyDown={e => { if (e.key === 'Enter') renameGroup(node.path, renameVal); if (e.key === 'Escape') setRenaming(null) }} />
          ) : (
            <span className="sb-label">{node.name}</span>
          )}
          <span className="sb-count">{node.children.length}</span>
        </div>
        {open && node.children.map((child) => (
          <SessionTreeNode key={child.id} node={child} depth={depth + 1}
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
            dropOnGroup={dropOnGroup} dropOnSession={dropOnSession} isDO={isDO} />
        ))}
      </div>
    )
  }
  const s = node.session
  const isDropTarget = isDO(node.id, 'session')
  const isRenamingThis = renamingSession === s.savedId
  const isCtxTarget = contextMenu?.type === 'session' && contextMenu.data.savedId === s.savedId
  return (
    <div
      className={`sb-row sb-session-row${isDropTarget ? ' drop-target' : ''}${isKbFocused ? ' sb-keyboard-focus' : ''}${isCtxTarget ? ' sb-context-target' : ''}`}
      data-tree-id={node.id}
      style={{ paddingLeft: indent + 18 }}
      draggable={!isRenamingThis}
      onDragStart={e => dStart(e, node.id, 'session')}
      onDragEnd={dEnd}
      onDragOver={e => dOver(e, node.id, 'session')}
      onDragLeave={dLeave}
      onDrop={e => dropOnSession(e, node.id, s.group || '')}
      onClick={() => !isRenamingThis && onConnectSaved(s)}
      onContextMenu={e => openCtx(e, 'session', s)}
      title={`${s.type?.toUpperCase()} ${sessionEndpoint(s)}`}>
      <span className="sb-session-icon" style={{ color: TYPE_COLORS[s.type as SessionType] }}>{ConnectionTypeIcon[s.type as SessionType]}</span>
      {isRenamingThis ? (
        <input className="sb-rename-input" value={renameSessionVal} autoFocus ref={renameSessionInputRef}
          onClick={e => e.stopPropagation()}
          onChange={e => setRenameSessionVal(e.target.value)}
          onBlur={() => {
            if (ignoreRenameSessionBlurRef.current) return
            renameSession(s.savedId, renameSessionVal)
          }}
          onKeyDown={e => {
            if (e.key === 'Enter') renameSession(s.savedId, renameSessionVal)
            if (e.key === 'Escape') setRenamingSession(null)
          }} />
      ) : (
        <span className="sb-label">{s.label || node.name}</span>
      )}
      {sessionHasSftp(s) && !isRenamingThis && <span className="sb-sftp-badge" title="SFTP">⇅</span>}
    </div>
  )
}
