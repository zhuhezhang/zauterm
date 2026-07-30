import { useState, useRef, useLayoutEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useI18n } from '@/context/I18nContext'
import { addGroupPlaceholder, exportSessions } from '@/store/sessionStore'
import { hasInvalidLabelChars } from '@/lib/safeFileName'
import type { SidebarContextMenuProps } from '@/types/components'

/** 上下文菜单组件：显示会话、分组、子分组、新分组等操作的上下文菜单 */
export default function SidebarContextMenu({
  ctx, closeCtx, onConnectSaved, onNewSession, dupSession, deleteSession, deleteGroup,
  setRenaming, setRenameVal, groupPlaceholders, onUpdatePlaceholders,
  expandAll, collapseAll, expandGroupAll, collapseGroupAll,
  setRenamingSession, setRenameSessionVal, savedSessions, onImportSessions,
}: SidebarContextMenuProps) {
  const { t } = useI18n()
  const [subInput, setSubInput] = useState<string | null>(null)
  const [newGroupInput, setNewGroupInput] = useState<string | null>(null)
  const subInputRef = useRef<HTMLInputElement | null>(null)
  const newGroupInputRef = useRef<HTMLInputElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const [menuPos, setMenuPos] = useState({ x: ctx.x, y: ctx.y })  // 上下文菜单位置

  useLayoutEffect(() => {  // 根据视口边界动态修正菜单位置，避免底部/右侧被遮挡
    const menuEl = menuRef.current
    if (!menuEl) return
    const margin = 8
    const maxX = Math.max(margin, window.innerWidth - menuEl.offsetWidth - margin)
    const maxY = Math.max(margin, window.innerHeight - menuEl.offsetHeight - margin)
    const nextX = Math.max(margin, Math.min(ctx.x, maxX))
    const nextY = Math.max(margin, Math.min(ctx.y, maxY))
    setMenuPos((prev) => (prev.x === nextX && prev.y === nextY ? prev : { x: nextX, y: nextY }))
  }, [ctx.x, ctx.y, subInput, newGroupInput])

  const renderInBody = (node: ReactNode) => {
    if (!document?.body) return null
    return createPortal(node, document.body)
  }

  if (subInput !== null) {
    return renderInBody(
      <div ref={menuRef} className="context-menu context-menu-input" style={{ top: menuPos.y, left: menuPos.x }} onClick={e => e.stopPropagation()}>
        <div className="context-menu-input-label">{t('sidebar.newSubGroup')}</div>
        <input className="context-menu-input-field" value={subInput} autoFocus placeholder={t('sidebar.namePh')} ref={subInputRef}
          onChange={e => setSubInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              const trimmed = subInput.trim()
              if (!trimmed) { alert(t('sidebar.groupNameEmpty')); return }
              if (hasInvalidLabelChars(trimmed)) { alert(t('sidebar.groupNameInvalid')); return }
              if (ctx.type !== 'group') return
              onUpdatePlaceholders?.(addGroupPlaceholder(groupPlaceholders, `${ctx.data}/${trimmed}`))
              setSubInput(null); closeCtx()
            }
            if (e.key === 'Escape') { setSubInput(null); closeCtx() }
          }} />
        <div className="context-menu-input-actions">
          <button type="button" onClick={() => { setSubInput(null); closeCtx() }}>{t('sidebar.cancel')}</button>
          <button type="button" className="confirm" onClick={() => {
            const trimmed = subInput.trim()
            if (!trimmed) { alert(t('sidebar.groupNameEmpty')); subInputRef.current?.focus(); return }
            if (hasInvalidLabelChars(trimmed)) { alert(t('sidebar.groupNameInvalid')); subInputRef.current?.focus(); return }
            onUpdatePlaceholders?.(addGroupPlaceholder(groupPlaceholders, `${ctx.data}/${trimmed}`))
            setSubInput(null); closeCtx()
          }}>{t('sidebar.confirm')}</button>
        </div>
      </div>
    )
  }

  if (newGroupInput !== null) {
    return renderInBody(
      <div ref={menuRef} className="context-menu context-menu-input" style={{ top: menuPos.y, left: menuPos.x }} onClick={e => e.stopPropagation()}>
        <div className="context-menu-input-label">{t('sidebar.newGroup')}</div>
        <input className="context-menu-input-field" value={newGroupInput} autoFocus placeholder={t('sidebar.namePh')} ref={newGroupInputRef}
          onChange={e => setNewGroupInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              const trimmed = newGroupInput.trim()
              if (!trimmed) { alert(t('sidebar.groupNameEmpty')); return }
              if (hasInvalidLabelChars(trimmed)) { alert(t('sidebar.groupNameInvalid')); return }
              onUpdatePlaceholders?.(addGroupPlaceholder(groupPlaceholders, trimmed))
              setNewGroupInput(null); closeCtx()
            }
            if (e.key === 'Escape') { setNewGroupInput(null); closeCtx() }
          }} />
        <div className="context-menu-input-actions">
          <button type="button" onClick={() => { setNewGroupInput(null); closeCtx() }}>{t('sidebar.cancel')}</button>
          <button type="button" className="confirm" onClick={() => {
            const trimmed = newGroupInput.trim()
            if (!trimmed) { alert(t('sidebar.groupNameEmpty')); newGroupInputRef.current?.focus(); return }
            if (hasInvalidLabelChars(trimmed)) { alert(t('sidebar.groupNameInvalid')); newGroupInputRef.current?.focus(); return }
            onUpdatePlaceholders?.(addGroupPlaceholder(groupPlaceholders, trimmed))
            setNewGroupInput(null); closeCtx()
          }}>{t('sidebar.confirm')}</button>
        </div>
      </div>
    )
  }
  return renderInBody(
    <div ref={menuRef} className="context-menu" style={{ top: menuPos.y, left: menuPos.x }} onClick={e => e.stopPropagation()}>
      {ctx.type === 'sessions-header' && (<>
        <button type="button" onClick={() => { onNewSession('ssh'); closeCtx() }}>{t('sidebar.newConnectionMenu')}</button>
        <button type="button" onClick={() => setNewGroupInput('')}>{t('sidebar.newGroup')}</button>
        <div className="context-menu-divider" />
        <button type="button" onClick={() => { expandAll(); closeCtx() }}>{t('sidebar.expandAll')}</button>
        <button type="button" onClick={() => { collapseAll(); closeCtx() }}>{t('sidebar.collapseAll')}</button>
        <div className="context-menu-divider" />
        <button type="button" onClick={() => { void exportSessions(savedSessions, t); closeCtx() }}>{t('settings.exportSessions')}</button>
        <button type="button" onClick={() => {
          closeCtx()
          queueMicrotask(() => onImportSessions())
        }}>{t('settings.importSessions')}</button>
      </>)}
      {ctx.type === 'session' && (<>
        <button type="button" onClick={() => { onConnectSaved(ctx.data); closeCtx() }}>{t('sidebar.connect')}</button>
        <button type="button" onClick={() => { onNewSession(ctx.data.type, ctx.data); closeCtx() }}>{t('sidebar.edit')}</button>
        <button type="button" onClick={() => { setRenamingSession(ctx.data.savedId); setRenameSessionVal(ctx.data.label || ''); closeCtx() }}>{t('sidebar.rename')}</button>
        <button type="button" onClick={() => { dupSession(ctx.data.savedId); closeCtx() }}>{t('sidebar.duplicate')}</button>
        <button type="button" className="danger" onClick={() => { deleteSession(ctx.data.savedId, ctx.data.label ?? ''); closeCtx() }}>{t('sidebar.delete')}</button>
      </>)}
      {ctx.type === 'group' && (<>
        <button type="button" onClick={() => { onNewSession('ssh', { group: ctx.data }); closeCtx() }}>{t('sidebar.newSession')}</button>
        <button type="button" onClick={() => { setRenaming(ctx.data); setRenameVal(ctx.data.split('/').pop() ?? ''); closeCtx() }}>{t('sidebar.renameGroup')}</button>
        <button type="button" onClick={() => setSubInput('')}>{t('sidebar.newSubGroup')}</button>
        <div className="context-menu-divider" />
        <button type="button" onClick={() => { expandGroupAll(ctx.data); closeCtx() }}>{t('sidebar.expandGroup')}</button>
        <button type="button" onClick={() => { collapseGroupAll(ctx.data); closeCtx() }}>{t('sidebar.collapseGroup')}</button>
        <div className="context-menu-divider" />
        <button type="button" className="danger" onClick={() => { deleteGroup(ctx.data); closeCtx() }}>{t('sidebar.deleteGroup')}</button>
      </>)}
    </div>
  )
}
