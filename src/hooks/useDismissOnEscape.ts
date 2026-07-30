import { useEffect } from 'react'

/**
 * 菜单/弹层打开时，按 Escape 键关闭
 * @param open 是否打开
 * @param onClose 关闭回调
 */
export function useDismissOnEscape(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return

    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape') return
      onClose()
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])
}
