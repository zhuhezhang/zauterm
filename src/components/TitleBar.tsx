import { useState, useEffect, type MouseEvent } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { useI18n } from '../context/I18nContext'
import { isIpcSuccess } from '@/lib/ipc/ipcResponse'
import '../styles/titlebar.css'

/** 是否为 MacOS */
const IS_MAC = navigator.userAgent.includes('Mac OS X') &&
  !navigator.userAgent.includes('Windows') &&
  !navigator.userAgent.includes('Linux')

/**
 * 标题栏组件，包含窗口控制按钮和应用标题
 * 通过 useState 管理窗口最大化状态，useEffect 订阅窗口事件并初始化状态
 * 根据平台条件渲染窗口控制按钮（MacOS 不显示）
 * Tauri 无边框窗口需 data-tauri-drag-region + startDragging 才能拖动
 */
export default function TitleBar({ onOpenAbout }: { onOpenAbout?: () => void }) {
  const { t } = useI18n()
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    const off = window.zauterm?.window.onMaximized((v) => setMaximized(v))
    window.zauterm?.window.isMaximized().then((res) => {
      if (isIpcSuccess(res)) setMaximized(!!res.content?.maximized)
    })
    return () => off?.()
  }, [])

  /** 在标题栏空白处按下左键时开始拖动窗口；按钮等交互元素除外 */
  const onDragMouseDown = (e: MouseEvent) => {
    if (e.buttons !== 1) return
    const el = e.target as HTMLElement | null
    if (el?.closest('button, a, input, textarea, select, [data-no-window-drag]')) return
    e.preventDefault()
    void getCurrentWindow().startDragging()
  }

  return (
    <div
      className={`titlebar ${IS_MAC ? 'is-mac' : 'is-not-mac'}`}
      data-tauri-drag-region
      onMouseDown={onDragMouseDown}
    >
      <div className="titlebar-drag" data-tauri-drag-region>
        <button
          type="button"
          className="titlebar-logo-btn"
          data-no-window-drag
          onClick={onOpenAbout}
          title={t('titlebar.about')}
        >
          ⚡ ZauTerm
        </button>
      </div>
      {!IS_MAC && (
        <div className="titlebar-controls" data-no-window-drag>
          <button className="titlebar-btn minimize" onClick={() => window.zauterm?.window.minimize()} title={t('titlebar.minimize')}>
            <svg width="10" height="1" viewBox="0 0 10 1"><rect width="10" height="1" fill="currentColor"/></svg>
          </button>
          <button className="titlebar-btn maximize" onClick={() => window.zauterm?.window.maximize()} title={maximized ? t('titlebar.restore') : t('titlebar.maximize')}>
            {maximized
              ? <svg width="10" height="10" viewBox="0 0 10 10"><path d="M2 0H10V8H8V10H0V2H2V0ZM3 1V3H1V9H7V7H9V1H3Z" fill="currentColor"/></svg>
              : <svg width="10" height="10" viewBox="0 0 10 10"><rect x="0" y="0" width="10" height="10" rx="1" stroke="currentColor" strokeWidth="1.2" fill="none"/></svg>
            }
          </button>
          <button className="titlebar-btn close" onClick={() => window.zauterm?.window.close()} title={t('titlebar.close')}>
            <svg width="10" height="10" viewBox="0 0 10 10"><path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </button>
        </div>
      )}
    </div>
  )
}
