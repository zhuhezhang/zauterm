/** 标签名 / 文件名非法字符（含 /） */
export const INVALID_LABEL_CHARS = new RegExp(`[/\\\\:*?"\\u003c\\u003e|${String.fromCharCode(0)}]`,)

/** SFTP 目录项 */
export interface SftpEntry {
  /** 文件名 */
  name: string
  /** 文件类型 */
  type: 'd' | '-' | string
  /** 文件路径 */
  path?: string
  /** 是否为目录 */
  isDir?: boolean
  /** 文件大小 */
  size?: number
  /** 修改时间 */
  modifyTime?: number
  /** 修改时间 */
  mtime?: number
}

/** 导入会话/设置 JSON 文件大小上限（8 MB，会话与设置共用） */
export const IMPORT_MAX_BYTES = 8 * 1024 * 1024