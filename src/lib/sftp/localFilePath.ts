/**
 * 沙盒渲染进程不提供 File.path，须通过 preload 的 webUtils.getPathForFile。
 * @param file 文件对象
 * @returns 文件路径
 */
export function getLocalFilePath(file: File): string {
  if (!file) return ''
  const bridge = window.zterm?.paths?.getPathForFile
  if (typeof bridge === 'function') {
    try {
      const p = bridge(file)
      if (p) return p
    } catch {}
  }
  return file.path || ''
}
