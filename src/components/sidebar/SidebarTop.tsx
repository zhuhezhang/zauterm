import type { SidebarTopProps } from '@/types/components'

/** 侧边栏顶部：包含展开/收起按钮和设置按钮 */
export default function SidebarTop({ open, onToggle, onOpenSettings, t }: SidebarTopProps) {
  return (
    <div className="sidebar-top">
      <button type="button" className="sidebar-toggle" onClick={onToggle} title={open ? t('sidebar.collapse') : t('sidebar.expand')}>
        <svg width="18" height="18" viewBox="0 0 16 16">
          {open
            ? <path d="M6 2L2 8L6 14M10 2L6 8L10 14" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
            : <path d="M10 2L14 8L10 14M6 2L10 8L6 14" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/>}
        </svg>
      </button>
      {open && <button type="button" className="sidebar-settings-btn" title={t('sidebar.settings')} onClick={onOpenSettings}>⚙</button>}
    </div>
  )
}
