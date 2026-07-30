/** 
 * 格式化文件大小
 * @param bytes 文件大小
 * @returns 格式化后的文件大小（例如：1024 B、1.0 KB、1.0 MB、1.00 GB）
 */
export function formatSftpSize(bytes: number | null | undefined): string {
  if (bytes == null) return '-'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB'
  return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB'
}

/** 
 * 格式化日期
 * @param ms 日期时间戳
 * @returns 格式化后的日期（例如：2026-06-05 10:00:00）
 */
export function formatSftpDate(ms: number | null | undefined): string {
  if (!ms) return '-'
  return new Date(ms).toLocaleString()
}
