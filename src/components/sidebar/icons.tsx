import type { FolderIconProps } from '@/types/components'

/** 连接类型颜色映射 */
export const TYPE_COLORS = { ssh: '#58a6ff', telnet: '#3fb950', serial: '#ffa657' }

/** sftp和会话分组展开/收起图标 */
export function Chevron() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
      <path d="M3 2l4 3-4 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

/** 文件夹图标组件，根据是否展开显示不同的图标 */
export function FolderIcon({ open }: FolderIconProps) {
  return (
    <svg width="18" height="23" viewBox="0 0 16 16" fill="currentColor" opacity="0.85">
      {open
        ? <path d="M1.5 3A1.5 1.5 0 000 4.5v8A1.5 1.5 0 001.5 14h13a1.5 1.5 0 001.5-1.5v-7A1.5 1.5 0 0014.5 4H7.707L6.354 2.646A.5.5 0 006 2.5H1.5z"/>
        : <path d="M.5 3l.04-.87a1.99 1.99 0 011.96-1.13H6a2 2 0 011.998 1.858L8 3h5.5A1.5 1.5 0 0115 4.5v8a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 011 12.5v-9A.5.5 0 00.5 3z"/>}
    </svg>
  )
}
