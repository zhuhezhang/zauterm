import { Component, type ErrorInfo } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { createTauriZterm } from './lib/ipc/tauriZterm'
import type { ErrorBoundaryProps, ErrorBoundaryState } from './types/components'
import './styles/global.css'

/**  React 错误边界组件，用于捕获子组件渲染过程中发生的错误，并显示友好的错误信息界面 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(e: Error): ErrorBoundaryState {
    return { error: e }
  }

  componentDidCatch(e: Error, info: ErrorInfo) {
    console.error('App crashed:', e, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 40, color: '#f85149', fontFamily: 'monospace', background: '#0d1117', minHeight: '100vh' }}>
          <h2>❌ App Render Error</h2>
          <pre style={{ marginTop: 16, whiteSpace: 'pre-wrap', color: '#e6edf3' }}>
            {this.state.error?.stack || String(this.state.error)}
          </pre>
        </div>
      )
    }
    return this.props.children
  }
}

// macOS 不触发 zoom-changed；Cmd+滚轮经 IPC 调整 zoom level（Win/Linux 由 Chromium zoom-changed + Ctrl+滚轮）
if (typeof window.zterm !== 'undefined' && /Mac/i.test(navigator.userAgent)) {
  window.addEventListener(
    'wheel',
    (e) => {
      if (!e.metaKey) return
      e.preventDefault()
      window.zterm!.window.zoomWheelStep(e.deltaY)
    },
    { passive: false, capture: true },
  )
}

window.zterm = createTauriZterm()

/**
 * 禁止把本地文件拖到窗口非上传区时，WebView 直接打开/导航到该文件。
 * 仅拦截 OS 文件拖入（dataTransfer 含 Files）；侧边栏会话/标签页的 HTML5 DnD 不受影响。
 * SFTP 区仍会收到 drop 并自行上传。
 */
;(() => {
  const blockFileNavigation = (e: DragEvent) => {
    const types = e.dataTransfer?.types
    if (!types) return
    const hasFiles = Array.from(types as ArrayLike<string>).includes('Files')
    if (!hasFiles) return
    e.preventDefault()
  }
  window.addEventListener('dragover', blockFileNavigation, true)
  window.addEventListener('drop', blockFileNavigation, true)
})()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
)
