import { useState, useRef, useCallback, useEffect, type FocusEvent, type MouseEvent } from 'react'
import type { SettingsHoverTip } from '@/types/settings'

/**
 * 使用设置悬浮提示
 * @returns 设置悬浮提示
 */
export function useSettingsHoverTip() {
  const [settingsHoverTip, setSettingsHoverTip] = useState<SettingsHoverTip | null>(null)
  const timerRef = useRef<number | null>(null)

  const hideSettingsHoverTip = useCallback(() => {  // 隐藏设置悬浮提示
    if (timerRef.current != null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    setSettingsHoverTip(null)
  }, [])

  /**
   * 显示设置悬浮提示
   * @param e 事件
   * @param text 提示文本
   */
  const showSettingsHoverTip = useCallback((e: MouseEvent | FocusEvent, text: string) => {
    if (timerRef.current != null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    const r = e.currentTarget.getBoundingClientRect()
    const x = r.left + r.width / 2
    const y = r.top
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null
      setSettingsHoverTip({ text, x, y })
    }, 1000)
  }, [])  // 依赖项为空，表示只在组件挂载时执行一次

  useEffect(() => {  // useEffect 监听设置悬浮提示是否隐藏
    document.addEventListener('pointerdown', hideSettingsHoverTip, true)  // 监听 document 点击事件，如果点击的是设置悬浮提示内部，则隐藏
    document.addEventListener('click', hideSettingsHoverTip, true)  // 监听 document 点击事件，如果点击的是设置悬浮提示内部，则隐藏
    return () => {
      document.removeEventListener('pointerdown', hideSettingsHoverTip, true)  // 卸载监听器
      document.removeEventListener('click', hideSettingsHoverTip, true)  // 卸载监听器
      if (timerRef.current != null) {
        clearTimeout(timerRef.current)  // 清除定时器
        timerRef.current = null  // 设置定时器为 null
      }
    }
  }, [hideSettingsHoverTip])

  return { settingsHoverTip, showSettingsHoverTip, hideSettingsHoverTip }
}
