import { useEffect } from 'react'

/**
 * 菜单/弹层打开时，点击外部区域关闭
 * @param open 是否打开
 * @param onClose 关闭回调
 * @param menuSelector 菜单根元素选择器（点击其内部不关闭）
 */
export function useDismissOnOutsideClick(
  open: boolean,
  onClose: () => void,
  menuSelector: string,
) {
  useEffect(() => {  // useEffect 监听菜单是否打开，如果未打开，则返回
    if (!open) return
    const onDocMouseDown = (e: globalThis.MouseEvent) => {  // 监听 document 点击事件，如果点击的是菜单根元素内部，则返回
      if ((e.target as Element | null)?.closest?.(menuSelector)) return
      onClose()
    }
    document.addEventListener('mousedown', onDocMouseDown)  // 监听 document 点击事件，如果点击的是菜单根元素内部，则返回
    return () => document.removeEventListener('mousedown', onDocMouseDown)  // 卸载监听器
  }, [open, onClose, menuSelector])
}
