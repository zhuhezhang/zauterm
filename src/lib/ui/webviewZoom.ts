// WebView 界面缩放（对齐 Electron webContents zoom level）
import { getCurrentWebview } from '@tauri-apps/api/webview'

/** Chromium/Electron zoom level：0 = 100%，每级约 ×1.2 */
let zoomLevel = 0
const ZOOM_LEVEL_MIN = -8
const ZOOM_LEVEL_MAX = 9

/** 计算缩放因子 */
function zoomFactor(): number {
  return Math.pow(1.2, zoomLevel)
}

/** 应用缩放 */
async function applyZoom(): Promise<void> {
  try {
    await getCurrentWebview().setZoom(zoomFactor())
  } catch (e) {
    console.warn('setZoom failed', e)
  }
}

/** 放大 */
export function zoomIn(): void {
  if (zoomLevel >= ZOOM_LEVEL_MAX) return
  zoomLevel += 1
  void applyZoom()
}

/** 缩小 */
export function zoomOut(): void {
  if (zoomLevel <= ZOOM_LEVEL_MIN) return
  zoomLevel -= 1
  void applyZoom()
}

/** 重置 */
export function zoomReset(): void {
  zoomLevel = 0
  void applyZoom()
}

/** 滚轮步进：deltaY < 0 放大，> 0 缩小 */
export function zoomWheelStep(deltaY: number): void {
  if (!Number.isFinite(deltaY) || deltaY === 0) return
  if (deltaY < 0) zoomIn()
  else zoomOut()
}

/** 是否是缩放修饰键 */
function isZoomModifier(e: KeyboardEvent | WheelEvent): boolean {
  return e.metaKey || e.ctrlKey
}

/** 注册 Ctrl/Cmd+滚轮与 Ctrl/Cmd+/-/0，与 Electron 行为对齐 */
export function attachWebviewZoomShortcuts(): void {
  window.addEventListener(
    'keydown',
    (e) => {
      if (!isZoomModifier(e) || e.altKey) return
      if (e.key === '-' || e.key === '_') {
        e.preventDefault()
        zoomOut()
      } else if (e.key === '=' || e.key === '+') {
        e.preventDefault()
        zoomIn()
      } else if (e.key === '0') {
        e.preventDefault()
        zoomReset()
      }
    },
    { capture: true },
  )

  window.addEventListener(
    'wheel',
    (e) => {
      if (!isZoomModifier(e)) return
      e.preventDefault()
      zoomWheelStep(e.deltaY)
    },
    { passive: false, capture: true },
  )
}
