import type { Terminal } from '@xterm/xterm'
import type { FitAddon } from '@xterm/addon-fit'

const MIN_COLS = 2
const MIN_ROWS = 1

/**
 * xterm 内部 core（FitAddon 同样依赖此私有 API）
 * @param term 终端实例
 * @returns 包含 _renderService 和 viewport 的核心对象
 */
function getTerminalCore(term: Terminal): {
  _renderService: { clear: () => void; dimensions: { css: { cell: { width: number; height: number } } } }
  viewport: { scrollBarWidth: number }
} {
  return (term as unknown as { _core: ReturnType<typeof getTerminalCore> })._core
}

/**
 * 计算滚动条宽度；scrollbarWidth 选项不可靠，且在 scrollback=0 时不占位
 * @param term 终端实例
 * @param core 终端核心对象
 * @returns 滚动条宽度（像素）
 */
function scrollbarWidthForFit(term: Terminal, core: ReturnType<typeof getTerminalCore>): number {
  if (term.options.scrollback === 0) return 0
  const measured = core.viewport.scrollBarWidth
  // 与 global.css 滚动条宽度一致；测得 0 时回退，避免叠加式滚动条不占位
  return measured || 6
}

/**
 * 按 xterm 元素实际 client 尺寸计算行列，预留垂直滚动条宽度。
 * 比 FitAddon.proposeDimensions 更准确：后者用父元素 CSS width，在 border-box + padding 时会多算列数导致画布盖住滚动条
 * @param term 终端实例
 * @returns 计算得到的行列数，或无法计算时返回 undefined
 */
export function proposeTerminalDimensions(
  term: Terminal,
): { cols: number; rows: number } | undefined {
  const el = term.element
  if (!el) return undefined

  const core = getTerminalCore(term)
  const dims = core._renderService.dimensions
  if (dims.css.cell.width === 0 || dims.css.cell.height === 0) return undefined

  const scrollbarWidth = scrollbarWidthForFit(term, core)
  const availableWidth = Math.max(0, el.clientWidth - scrollbarWidth)
  const availableHeight = Math.max(0, el.clientHeight)

  return {
    cols: Math.max(MIN_COLS, Math.floor(availableWidth / dims.css.cell.width)),
    rows: Math.max(MIN_ROWS, Math.floor(availableHeight / dims.css.cell.height)),
  }
}

/**
 * 将终端尺寸适配到容器；下一帧再 fit 一次以便滚动条宽度测量稳定
 * @param fitAddon FitAddon 实例
 */
export function fitTerminal(fitAddon: FitAddon): void {
  const term = (fitAddon as unknown as { _terminal?: Terminal })._terminal
  if (!term) return

  const apply = () => {
    const dims = proposeTerminalDimensions(term)
    if (!dims) return
    const core = getTerminalCore(term)
    if (term.rows !== dims.rows || term.cols !== dims.cols) {
      core._renderService.clear()
      term.resize(dims.cols, dims.rows)
    }
  }

  try {
    apply()
    requestAnimationFrame(() => {
      try { apply() } catch {}
    })
  } catch {}
}
