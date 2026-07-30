/** 单次导入会话条数上限 */
export const IMPORT_MAX_SESSION_COUNT = 99999

/** zterm 导出 envelope 版本号 */
export const EXPORT_ENVELOPE_VERSION = 1

/** 导出文件名前缀（下载名：{prefix}-YYYYMMDD-HHMMSS.json） */
export const EXPORT_FILENAME_PREFIX = {
  sessions: 'zterm-sessions',
  settings: 'zterm-settings',
}

/** 隐藏 file input 的 accept 属性 */
export const IMPORT_JSON_ACCEPT = '.json'
