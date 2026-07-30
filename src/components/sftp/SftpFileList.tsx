import type { DragEvent as ReactDragEvent, MouseEvent as ReactMouseEvent } from 'react'
import type { SftpRemoteItem } from '@/types/components'
import { formatSftpSize, formatSftpDate } from '@/lib/sftp/format'

/** SFTP 文件列表组件属性 */
export interface SftpFileListProps {
  /** 当前路径 */
  path: string
  /** 文件列表 */
  items: SftpRemoteItem[]
  /** 是否加载中 */
  loading: boolean
  /** 选中文件 */
  selected: SftpRemoteItem | null
  /** 右键菜单当前目标路径（仅菜单打开时高亮，与左键 selected 分离） */
  contextTargetPath: string | null
  /** 重命名文件 */
  renaming: SftpRemoteItem | null
  /** 重命名值 */
  renameValue: string
  /** 翻译函数 */
  t: (path: string, params?: Record<string, string | number>) => string
  /** 上移到父目录 */
  onGoUp: () => void
  /** 点击文件 */
  onItemClick: (item: SftpRemoteItem) => void
  /** 右键点击文件 */
  onItemContextMenu: (e: ReactMouseEvent, item: SftpRemoteItem) => void
  /** 重命名值变化 */
  onRenameValueChange: (value: string) => void
  /** 提交重命名 */
  onCommitRename: () => void
  /** 取消重命名 */
  onCancelRename: () => void
  /** 拖拽上传 */
  onDropUpload: (e: ReactDragEvent<HTMLDivElement>) => void
}

/** SFTP 文件列表组件 */
export default function SftpFileList({
  path,
  items,
  loading,
  selected,
  contextTargetPath,
  renaming,
  renameValue,
  t,
  onGoUp,
  onItemClick,
  onItemContextMenu,
  onRenameValueChange,
  onCommitRename,
  onCancelRename,
  onDropUpload,
}: SftpFileListProps) {
  return (
    <div className="sftp-file-list" onDragOver={e => e.preventDefault()} onDrop={onDropUpload}>
      {path !== '/' && (
        <div className="sftp-item sftp-item-dir" onClick={onGoUp}>
          <span className="sftp-item-icon">📂</span>
          <span className="sftp-item-name">..</span>
        </div>
      )}
      {loading && <div className="sftp-loading">{t('sftp.loading')}</div>}
      {!loading && items.map(item => (
        <div
          key={item.path}
          className={`sftp-item ${item.isDir ? 'sftp-item-dir' : 'sftp-item-file'} ${selected?.path === item.path ? 'selected' : ''}${contextTargetPath === item.path ? ' sftp-context-target' : ''} ${renaming?.path === item.path ? 'renaming' : ''}`}
          onClick={() => onItemClick(item)}
          onContextMenu={(e) => onItemContextMenu(e, item)}
        >
          <span className="sftp-item-icon">{item.isDir ? '📁' : '📄'}</span>
          {renaming?.path === item.path ? (
            <input
              className="sftp-rename-input"
              value={renameValue}
              autoFocus
              onClick={e => e.stopPropagation()}
              onChange={e => onRenameValueChange(e.target.value)}
              onBlur={onCommitRename}
              onKeyDown={e => { if (e.key === 'Enter') onCommitRename(); if (e.key === 'Escape') onCancelRename() }}
            />
          ) : (
            <span className="sftp-item-name">{item.name}</span>
          )}
          <span className="sftp-item-size">{item.isDir ? '' : formatSftpSize(item.size)}</span>
          <span className="sftp-item-date">{formatSftpDate(item.mtime)}</span>
        </div>
      ))}
      {!loading && items.length === 0 && (
        <div className="sftp-empty">{t('sftp.empty')}</div>
      )}
    </div>
  )
}
