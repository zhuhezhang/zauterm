import { useEffect } from 'react'

/**
 * 应用内全局快捷键：打开当前活跃标签页终端内容搜索（macOS Cmd+Shift+F，Windows/Linux Ctrl+Shift+F）
 * @param onTrigger 快捷键触发时的回调函数，通常用于调用 setSearchOpen(true) 来打开搜索栏
 */
export function useFocusTerminalSearchShortcut(onTrigger: () => void) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'f' && e.key !== 'F') return  // 如果不是 f 或 F 键，则不处理
      if (!e.shiftKey || e.altKey) return  // 如果不是 Shift+F 键，则不处理
      const mod = /Mac/i.test(navigator.userAgent) ? e.metaKey : e.ctrlKey  // 获取操作系统类型
      if (!mod) return  // 如果不是 Cmd 或 Ctrl 键，则不处理
      e.preventDefault()  // 阻止默认行为
      e.stopPropagation()  // 阻止事件冒泡
      onTrigger()  // 调用回调函数
    }
    document.addEventListener('keydown', onKeyDown, { capture: true })  // 监听键盘事件
    return () => document.removeEventListener('keydown', onKeyDown, { capture: true })  // 移除键盘事件监听
  }, [onTrigger])
}

/**
 * 应用内全局快捷键：聚焦侧边栏「搜索已保存会话」输入框（macOS Cmd+F，Windows/Linux Ctrl+F）
 * @param onTrigger 快捷键触发时的回调函数，通常用于调用 revealAndFocusSessionSearch() 来实现滚动和聚焦
 */
export function useFocusSavedSessionSearchShortcut(onTrigger: () => void) {
    useEffect(() => {
      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key !== 'f' && e.key !== 'F') return
        if (e.altKey || e.shiftKey) return
        const mod = /Mac/i.test(navigator.userAgent) ? e.metaKey : e.ctrlKey  // 
        if (!mod) return
        e.preventDefault()
        e.stopPropagation()
        onTrigger()
      }
      document.addEventListener('keydown', onKeyDown, { capture: true })
      return () => document.removeEventListener('keydown', onKeyDown, { capture: true })
    }, [onTrigger])
  }