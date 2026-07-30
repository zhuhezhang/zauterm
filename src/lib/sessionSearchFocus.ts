/**
 * 将「保存的会话」区块滚到侧边栏内容区顶部，便于同时看到搜索框与结果列表
 * @param input 「搜索已保存会话」输入框元素
 */
function scrollSessionsSectionToTop(input: HTMLInputElement) {
  const anchor =
    input.closest('.sb-sessions-scroll')?.querySelector('.sessions-header')
    ?? input.closest('.sb-session-search-wrap')
    ?? input
  anchor.scrollIntoView({ block: 'start', inline: 'nearest' })
}

/**
 * 将「搜索已保存会话」输入框滚入可见区域并聚焦；布局未稳定时多帧重试 scroll
 * @param getInput 获取「搜索已保存会话」输入框元素的函数
 * @param onComplete 可选的回调函数，在达到最大重试次数后调用
 * @returns 取消操作的函数
 */
export function revealAndFocusSessionSearch(
  getInput: () => HTMLInputElement | null,
  onComplete?: () => void,
): () => void {
  let cancelled = false
  let focused = false
  let attempts = 0
  const maxAttempts = 12

  const tick = () => {
    if (cancelled) return
    const el = getInput()
    if (el) {
      scrollSessionsSectionToTop(el)
      if (!focused) {
        el.focus({ preventScroll: true })
        el.select()
        focused = true
      }
    }
    attempts += 1
    if (attempts < maxAttempts) {
      requestAnimationFrame(tick)
    } else {
      onComplete?.()
    }
  }
  requestAnimationFrame(tick)
  return () => { cancelled = true }
}
