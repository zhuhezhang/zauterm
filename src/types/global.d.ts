/** 渲染进程：扩展 Window / File 等环境类型（无 import，由 tsconfig include 自动合并） */

/** 文件对象类型扩展 */
interface File {
  /** 文件路径 */
  readonly path?: string
}

/** 窗口对象类型扩展 */
interface Window {
  /** 显示目录选择器 */
  showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>
}
