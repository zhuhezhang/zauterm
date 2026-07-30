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

ReactDOM.createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
)
