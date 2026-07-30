/**
 * 主进程 ↔ 渲染进程 IPC 统一响应：{ success, content }；失败时另含 errorKnown
 * 前后端共用类型；主进程构造/识别见 electron/lib/ipcResponse.ts（ipcOk、isIpcError 等）
 */

/** IPC content 允许的 JSON 值（含结构化对象，如 SftpEntry[]、SerialPortInfo[]） */
type IpcJsonValue =
  | string
  | number
  | boolean
  | null
  | IpcJsonValue[]
  | { [key: string]: IpcJsonValue }
  | object

/** IPC 响应 content 字段，表示主进程 ↔ 渲染进程之间传递的「业务载荷」 */
export type IpcContent = {
  /** 错误信息（可选）：已知错误时是 i18n 错误码（如 'app.invalidRequest'）；未知错误时是库/系统的原始 message */
  error?: string
  /** 错误参数（可选）：已知错误时是错误码的参数（如{name: '张三'}）；未知错误时是空对象 */
  errorParams?: Record<string, string | number>
} & Record<string, IpcJsonValue | undefined>  // & 交叉类型将多个类型合并为一个类型；Record<string, IpcJsonValue | undefined> 也就是{[key: string]: IpcJsonValue | undefined}，称为索引类型，IpcContent 里面的字段名是 string，字段值是 IpcJsonValue 或 undefined

/** 
 * IPC 成功响应
 * 典型例子：{ success: true, content: { ports: [...] } }
 */
export interface IpcOk<T extends IpcContent = IpcContent> {  // ”= IpcContent“ 表示不指定类型时默认就是 IpcContent
  /** 是否成功 */
  success: true
  /** 业务载荷 */
  content: T
}

/**
 * IPC 失败响应
 * 
 * 典型例子1：失败（已知错误，可 i18n）
 * {
 *   success: false,
 *   errorKnown: true,
 *   content: {
 *     error: 'sftp.pathNotFound',
 *     errorParams: { path: '/tmp/foo' }
 *   }
 * }
 * 
 * 典型例子2：失败（未知错误，直接展示 message）
 * {
 *   success: false,
 *   errorKnown: false,
 *   content: { error: 'Connection refused' }
 * }
 */
export interface IpcFail<T extends IpcContent = IpcContent> {
  /** 是否成功 */
  success: false
  /** 是否已知错误码（是否是自定义的错误码） */
  errorKnown: boolean
  /** 错误信息 */
  content: T & { error: string }  // ”& { error: string }“ 表示 content 必须包含 error 字段
}

/** IPC 响应结果 */
export type IpcResult<T extends IpcContent = IpcContent> = IpcOk<T> | IpcFail<T>  // 返回值为IpcOk<T> 或 IpcFail<T>

/** 带 i18n 错误码的 Error（主进程路径策略等 throw，ipcFailFromThrown 识别） */
export interface IpcError extends Error {
  /** i18n 错误码 */
  ipcCode: string
  /** 错误参数（如{name: '张三'}） */
  ipcParams: Record<string, string | number>
  /** 是否已知错误码（是否是自定义的错误码） */
  ipcKnown: boolean
}
