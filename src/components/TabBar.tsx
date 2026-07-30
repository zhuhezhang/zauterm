import { useState, useRef, useEffect, useLayoutEffect, memo, type DragEvent, type MouseEvent } from 'react'
import { useI18n } from '../context/I18nContext'
import { useDismissOnOutsideClick } from '@/hooks/useDismissOnOutsideClick'
import { useDismissOnEscape } from '@/hooks/useDismissOnEscape'
import { ConnectionTypeIcon } from './common'
import type { TabBarProps } from '../types/components'
import { sessionEndpoint } from '../types/session'
import type { TabContextMenu } from '../types/components'
import type { BackspaceMode } from '../types/session'
import { normalizeBackspaceMode } from '../lib/session/utils'
import { terminalSearchShortcutLabel } from '../lib/keyboardShortcut'
import '../styles/tabbar.css'

/** 状态点类名映射（样式见 tabbar.css） */
const STATUS_CLS = {
  connecting: 'connecting',
  connected: 'connected',
  disconnected: 'disconnected',
  reconnecting: 'reconnecting',
  error: 'error',
} as const

/**
 * 标签栏组件，显示当前会话列表和控制按钮。
 * 通过 useState 管理右键菜单状态，useRef 管理拖拽状态和 DOM 引用。
 * 支持标签页选择、关闭、新建、右键菜单操作和拖拽排序
 */
export default memo(function TabBar({
  sessions,
  activeId,
  onSelect,
  onClose,
  onNew,
  onReorder,
  onSaveOutput,
  onClearScreen,
  onSearchTerminal,
  onSetBackspaceMode,
}: TabBarProps) {
  const { t } = useI18n()
  const [ctxMenu, setCtxMenu] = useState<TabContextMenu | null>(null)
  const [ctxMenuPos, setCtxMenuPos] = useState({ x: 0, y: 0 })  // 调整后的右键菜单位置
  const [backspaceSubmenuFlip, setBackspaceSubmenuFlip] = useState(false)
  const backspaceSubmenuRef = useRef<HTMLDivElement | null>(null)
  const contextMenuRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<string | null>(null)
  const tabsRef = useRef<HTMLDivElement | null>(null)
  const prevCountRef = useRef(sessions.length) // 上一次会话数量的引用，用于检测新增标签页

  // useEffect 监听 sessions.length 变化，如果增加了新的会话且 tabsRef 已经挂载，就将 scrollLeft 设置为 scrollWidth，
  // 使得标签栏滚动到最右侧，确保新标签页可见。最后更新 prevCountRef.current 为当前的 sessions.length，以便下一次比较。
  useEffect(() => {
    if (sessions.length > prevCountRef.current && tabsRef.current) {
      tabsRef.current.scrollLeft = tabsRef.current.scrollWidth
    }
    prevCountRef.current = sessions.length
  }, [sessions.length])

  /** 
   * 右键菜单操作函数，分别用于关闭当前标签页、关闭其他标签页、关闭左侧标签页、关闭右侧标签页和关闭全部标签页。
   * 每个函数调用对应的 onClose 回调来关闭指定的标签页，并调用 closeCtx 来关闭右键菜单
   * @param e 右键点击事件对象
   * @param id 要关闭的标签页 ID
   * @param idx 要关闭的标签页索引
   */
  const openCtx = (e: MouseEvent, id: string, idx: number) => {
    e.preventDefault()
    e.stopPropagation()  // 阻止事件冒泡，避免触发父元素的点击事件
    setCtxMenu({ x: e.clientX, y: e.clientY, id, idx })
  }

  /** 关闭右键菜单 */
  const closeCtx = () => setCtxMenu(null)

  /** 更新退格键模式子菜单的翻转状态 */
  const updateBackspaceSubmenuFlip = () => {
    const root = backspaceSubmenuRef.current
    if (!root) return
    const trigger = root.querySelector('.context-menu-submenu-trigger')
    const panel = root.querySelector('.context-menu-submenu-panel')
    if (!(trigger instanceof HTMLElement) || !(panel instanceof HTMLElement)) return
    const margin = 8
    const panelWidth = panel.offsetWidth || 123
    setBackspaceSubmenuFlip(trigger.getBoundingClientRect().right + panelWidth + margin > window.innerWidth)
  }

  useLayoutEffect(() => {   // 根据视口边界动态修正菜单位置，避免被遮挡
    const menuEl = contextMenuRef.current
    if (!ctxMenu || !menuEl) return
    const margin = 8
    const maxX = Math.max(margin, window.innerWidth - menuEl.offsetWidth - margin)
    const maxY = Math.max(margin, window.innerHeight - menuEl.offsetHeight - margin)
    const nextX = Math.max(margin, Math.min(ctxMenu.x, maxX))
    const nextY = Math.max(margin, Math.min(ctxMenu.y, maxY))
    setCtxMenuPos((prev) => (prev.x === nextX && prev.y === nextY ? prev : { x: nextX, y: nextY }))
  }, [ctxMenu])

  useLayoutEffect(() => {   // 监听右键菜单的打开状态和退格键模式设置回调，如果打开且有回调，则更新退格键模式子菜单的翻转状态
    if (!ctxMenu || !onSetBackspaceMode) return
    updateBackspaceSubmenuFlip()
  }, [ctxMenu, onSetBackspaceMode])

  useDismissOnOutsideClick(!!ctxMenu, closeCtx, '.context-menu')
  useDismissOnEscape(!!ctxMenu, closeCtx)
  /**
   * 关闭标签页
   * @param id 要关闭的标签页 ID
   */
  const closeTab = (id: string) => { onClose(id); closeCtx() }
  /**
   * 关闭其他标签页
   * @param id 要保留的标签页 ID
   */
  const closeOthers = (id: string) => { sessions.filter(s => s.id !== id).forEach(s => onClose(s.id)); closeCtx() }
  /**
   * 关闭左侧标签页
   * @param idx 要关闭的标签页索引
   */
  const closeLeft = (idx: number) => { sessions.slice(0, idx).forEach(s => onClose(s.id)); closeCtx() }
  /**
   * 关闭右侧标签页
   * @param idx 要关闭的标签页索引
   */
  const closeRight = (idx: number) => { sessions.slice(idx + 1).forEach(s => onClose(s.id)); closeCtx() }
  /** 关闭全部标签页 */
  const closeAll    = () => { sessions.forEach(s => onClose(s.id)); closeCtx() }

  /** 退格键模式列表 */
  const BACKSPACE_MODES: BackspaceMode[] = ['auto', 'del', 'bs']
  /** 退格键模式标签 */
  const backspaceModeLabels: Record<BackspaceMode, string> = {
    auto: t('settings.options.backspaceAuto'),
    del: t('settings.options.backspaceDel'),
    bs: t('settings.options.backspaceBs'),
  }

  /** 设置退格键模式 */
  const setBackspaceMode = (sessionId: string, mode: BackspaceMode) => {
    onSetBackspaceMode?.(sessionId, mode)
    closeCtx()
  }

  /** 当前右键菜单的会话 */
  const ctxSession = ctxMenu ? sessions.find(s => s.id === ctxMenu.id) : null
  /** 当前右键菜单的会话的退格键模式 */
  const ctxBackspaceMode = normalizeBackspaceMode(ctxSession?.backspaceMode) ?? 'auto'

  /**
   * 拖拽事件处理函数：开始拖拽
   * onDragStart 设置 dragRef.current 为当前拖拽的标签 ID，并添加 dragging 类以改变样式。
   * @param e 拖拽事件对象
   * @param id 当前拖拽的标签页 ID
   */
  const onDragStart = (e: DragEvent<HTMLDivElement>, id: string) => {
    dragRef.current = id
    e.dataTransfer.effectAllowed = 'move'  // 告诉浏览器这次拖拽是移动操作；这会影响拖拽光标样式和可用 drop 行为；说明用户移动标签，而不是复制
    e.dataTransfer.setData('text/plain', id)  // 设置拖拽数据为标签 ID，虽然在这个实现中我们不依赖这个数据，但它是必须的，否则某些浏览器可能无法正确处理拖拽事件
    e.currentTarget.classList.add('dragging')  // 添加 dragging 类以改变样式，提供视觉反馈，告诉用户正在拖拽哪个标签
  }

  /** 
   * 拖拽事件处理函数：拖拽经过
   * onDragOver 调用 e.preventDefault() 以允许 drop，并设置拖拽效果为 move。
   * @param e 拖拽事件对象
   */
  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  /** 
   * 拖拽事件处理函数：放下
   * onDrop 获取拖拽来源的标签 ID（fromId）和目标标签 ID（toId），如果有效且不同，则调用 onReorder 回调来更新标签顺序，并重置 dragRef.current。
   * @param e 拖拽事件对象
   * @param toId 放下目标的标签页 ID
   */
  const onDrop = (e: DragEvent<HTMLDivElement>, toId: string) => {
    e.preventDefault()
    const fromId = dragRef.current
    if (!fromId || fromId === toId) return
    if (onReorder) onReorder(fromId, toId)
    dragRef.current = null
  }

  /** 
   * 拖拽事件处理函数：结束拖拽
   * onDragEnd 将 dragRef.current 重置为 null，并移除 dragging 类。
   * @param e 拖拽事件对象
   */
  const onDragEnd = (e: DragEvent<HTMLDivElement>) => {
    e.currentTarget.classList.remove('dragging')
    dragRef.current = null
  }

  return (
    <div className="tabbar" onClick={ctxMenu ? closeCtx : undefined}>
      <div className="tabbar-tabs" ref={tabsRef}>  {/* ref={tabsRef} 用于把这个 div 的真实 DOM 元素保存到 tabsRef.current */}
        {sessions.map((s, idx) => (
          <div
            key={s.id}
            className={`tab ${s.id === activeId ? 'active' : ''}`}
            onClick={() => onSelect(s.id)}
            onContextMenu={(e) => openCtx(e, s.id, idx)}
            draggable
            onDragStart={(e) => onDragStart(e, s.id)}
            onDragEnd={onDragEnd}
            onDragOver={onDragOver}
            onDrop={(e) => onDrop(e, s.id)}
            title={s.label || `${s.type?.toUpperCase()} ${sessionEndpoint(s)}`}
          >
            <span className="tab-icon">{ConnectionTypeIcon[s.type] || '⌨'}</span>
            <span
              className={`tab-status ${STATUS_CLS[s.status as keyof typeof STATUS_CLS] || 'disconnected'}`}
              aria-hidden="true"
            />
            <span className="tab-label">{s.label || `${s.type?.toUpperCase()} ${sessionEndpoint(s)}`}</span>
            {s.sftpReady && <span className="tab-sftp-badge" title={t('tabbar.sftpReady')}>⇅</span>}
            <button className="tab-close" onClick={e => { e.stopPropagation(); onClose(s.id) }} title={t('tabbar.closeTab')}>×</button>
          </div>
        ))}
        <button className="tab-new" onClick={onNew} title={t('tabbar.newConnection')}>＋</button>
      </div>

      {ctxMenu && (
        <div
          ref={contextMenuRef}
          className="context-menu"
          style={{ top: ctxMenuPos.y, left: ctxMenuPos.x }}
          onClick={e => e.stopPropagation()}
        >
          <button onClick={() => closeTab(ctxMenu.id)}>{t('tabbar.closeThis')}</button>
          <button onClick={() => closeOthers(ctxMenu.id)} disabled={sessions.length <= 1}>{t('tabbar.closeOthers')}</button>
          <button onClick={() => closeLeft(ctxMenu.idx)} disabled={ctxMenu.idx === 0}>{t('tabbar.closeLeft')}</button>
          <button onClick={() => closeRight(ctxMenu.idx)} disabled={ctxMenu.idx === sessions.length - 1}>{t('tabbar.closeRight')}</button>
          <div className="context-menu-divider" />
          <button onClick={() => { onSaveOutput?.(ctxMenu.id); closeCtx() }}>{t('tabbar.saveOutput')}</button>
          <button
            type="button"
            className="context-menu-item-split"
            onClick={() => { onSearchTerminal?.(ctxMenu.id); closeCtx() }}
            disabled={ctxMenu.id !== activeId}
          >
            <span>{t('tabbar.searchTerminal')}</span>
            <span className="context-menu-shortcut" aria-hidden="true">{terminalSearchShortcutLabel()}</span>
          </button>
          <button onClick={() => { onClearScreen?.(ctxMenu.id); closeCtx() }}>{t('tabbar.clearScreen')}</button>
          {onSetBackspaceMode && (
            <>
              <div className="context-menu-divider" />
              <div
                ref={backspaceSubmenuRef}
                className="context-menu-submenu"
                onMouseEnter={updateBackspaceSubmenuFlip}
              >
                <button type="button" className="context-menu-submenu-trigger">
                  <span>{t('connect.backspaceMode')}</span>
                  <span className="context-menu-submenu-arrow" aria-hidden="true">›</span>
                </button>
                <div
                  className={`context-menu context-menu-submenu-panel${backspaceSubmenuFlip ? ' context-menu-submenu-panel--flip' : ''}`}
                  onClick={e => e.stopPropagation()}
                >
                  {BACKSPACE_MODES.map(mode => (
                    <button
                      key={mode}
                      type="button"
                      className={mode === ctxBackspaceMode ? 'checked' : ''}
                      onClick={() => setBackspaceMode(ctxMenu.id, mode)}
                    >
                      <span className="context-menu-check">{mode === ctxBackspaceMode ? '✓' : ''}</span>
                      {backspaceModeLabels[mode]}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
          <div className="context-menu-divider" />
          <button className="danger" onClick={closeAll}>{t('tabbar.closeAll')}</button>
        </div>
      )}
    </div>
  )
})
