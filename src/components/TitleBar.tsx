import { useState, useEffect } from 'react'
import { useI18n } from '../context/I18nContext'
import { isIpcSuccess } from '@/lib/ipc/ipcResponse'
import '../styles/titlebar.css'

/** 是否为 MacOS */
const IS_MAC = navigator.userAgent.includes('Mac OS X') &&
  !navigator.userAgent.includes('Windows') &&
  !navigator.userAgent.includes('Linux')

/**
 * 标题栏组件，包含窗口控制按钮和应用标题
 * 通过 useState 管理窗口最大化状态，useEffect 订阅 Electron 窗口事件并初始化状态
 * 根据平台条件渲染窗口控制按钮（MacOS 不显示）
 */
export default function TitleBar({ onOpenAbout }: { onOpenAbout?: () => void }) {
  const { t } = useI18n()
  const [maximized, setMaximized] = useState(false)

  // 需要 useEffect，因为这段逻辑是：
  // 与 UI 渲染无关的副作用；需要在组件挂载后执行；应该只执行一次，而不是每次 render 都执行；访问外部系统（Electron IPC）来订阅事件和获取初始状态
  useEffect(() => {
    const off = window.zterm?.window.onMaximized((v) => setMaximized(v))
    window.zterm?.window.isMaximized().then((res) => {
      if (isIpcSuccess(res)) setMaximized(!!res.content?.maximized)
    })
    return () => off?.()
  }, [])

  return (
    <div className={`titlebar ${IS_MAC ? 'is-mac' : 'is-not-mac'}`}>
      <div className="titlebar-drag">
        <button
          type="button"
          className="titlebar-logo-btn"
          onClick={onOpenAbout}
          title={t('titlebar.about')}
        >
          ⚡ ZTerm
        </button>
      </div>
      {!IS_MAC && (
        <div className="titlebar-controls">
          <button className="titlebar-btn minimize" onClick={() => window.zterm?.window.minimize()} title={t('titlebar.minimize')}>
            <svg width="10" height="1" viewBox="0 0 10 1"><rect width="10" height="1" fill="currentColor"/></svg>
          </button>
          <button className="titlebar-btn maximize" onClick={() => window.zterm?.window.maximize()} title={maximized ? t('titlebar.restore') : t('titlebar.maximize')}>
            {maximized
              ? <svg width="10" height="10" viewBox="0 0 10 10"><path d="M2 0H10V8H8V10H0V2H2V0ZM3 1V3H1V9H7V7H9V1H3Z" fill="currentColor"/></svg>
              : <svg width="10" height="10" viewBox="0 0 10 10"><rect x="0" y="0" width="10" height="10" rx="1" stroke="currentColor" strokeWidth="1.2" fill="none"/></svg>
            }
          </button>
          <button className="titlebar-btn close" onClick={() => window.zterm?.window.close()} title={t('titlebar.close')}>
            <svg width="10" height="10" viewBox="0 0 10 10"><path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </button>
        </div>
      )}
    </div>
  )
}
