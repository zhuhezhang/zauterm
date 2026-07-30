import type { AppTheme } from '@/types/settings'
import type { ITheme } from '@xterm/xterm'

/**
 * 根据设置解析当前应使用的亮/暗主题（auto 时读取系统 prefers-color-scheme）
 * @param appTheme 主题名称
 * @returns 当前实际主题名称
 */
export function resolveEffectiveAppTheme(appTheme: AppTheme): 'dark' | 'light' {
  if (appTheme === 'light') return 'light'
  if (appTheme === 'dark') return 'dark'
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  } catch {
    return 'dark'
  }
}

/**
 * 获取 xterm 内置主题
 * @param mode 主题名称
 * @returns xterm 内置主题
 */
export function getXtermTheme(mode: 'dark' | 'light'): ITheme {
  if (mode === 'light') {
    return {
      background: '#ffffff',
      foreground: '#1f2328',
      cursor: '#0969da',
      cursorAccent: '#ffffff',
      selectionBackground: '#add6ff',
      black: '#656d76',
      red: '#cf222e',
      green: '#1a7f37',
      yellow: '#9a6700',
      blue: '#0969da',
      magenta: '#8250df',
      cyan: '#1b7c83',
      white: '#6e7781',
      brightBlack: '#8c959f',
      brightRed: '#a40e26',
      brightGreen: '#116329',
      brightYellow: '#7d4e00',
      brightBlue: '#0550ae',
      brightMagenta: '#6639ba',
      brightCyan: '#3192aa',
      brightWhite: '#1f2328',
    }
  }
  return {
    background: '#0d1117',
    foreground: '#e6edf3',
    cursor: '#58a6ff',
    cursorAccent: '#0d1117',
    selectionBackground: '#264f78',
    black: '#484f58',
    red: '#ff7b72',
    green: '#3fb950',
    yellow: '#d29922',
    blue: '#58a6ff',
    magenta: '#bc8cff',
    cyan: '#39c5cf',
    white: '#b1bac4',
    brightBlack: '#6e7681',
    brightRed: '#ffa198',
    brightGreen: '#56d364',
    brightYellow: '#e3b341',
    brightBlue: '#79c0ff',
    brightMagenta: '#d2a8ff',
    brightCyan: '#56d4dd',
    brightWhite: '#f0f6fc',
  }
}
