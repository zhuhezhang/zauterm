/** 渲染进程 window.zauterm API 契约（Tauri 实现见 src/lib/ipc/tauriZauterm.ts） */
import type { AlgorithmPreferences } from '../ssh/sshAlgorithmDefaults'
import type { IpcContent, IpcResult } from './contract'
import type { SftpEntry } from '../constants'

/** 进度信息，用于 SFTP 上传 / 下载进度提示 */
export interface ZauTermProgress {
  /** 进度类型 */
  type?: string
  /** 已传输的字节数 */
  transferred?: number
  /** 总字节数 */
  total?: number
  /** 百分比 */
  percent?: number
  /** 文件名 */
  file?: string
}

/** 凭据库同步涉及的敏感字段 */
export type VaultSecretKey = 'password' | 'privateKey' | 'passphrase'

/** 凭据库同步涉及的敏感字段部分 */
export type VaultSecretPartial = Partial<Record<VaultSecretKey, string | null>>

/** 凭据获取原因，用于凭据获取失败提示 */
export type VaultGetReason =
  | 'invalidSavedId'
  | 'encryptionUnavailable'
  | 'notInVault'
  | 'decryptFailed'

/** 凭据获取内容 */
export type VaultGetContent =
  | { found: false; reason: VaultGetReason }  // 凭据未找到
  | { found: true; password?: string; privateKey?: string; passphrase?: string }  // 凭据找到

/** SSH / SFTP 连接载荷，用于 SSH / SFTP 连接配置 */
export interface SshConnectConfig {
  /** 主机名 */
  host?: string
  /** 端口 */
  port?: number
  /** 用户名 */
  username?: string
  /** 认证类型 */
  authType?: string
  /** 密码 */
  password?: string
  /** 私钥 */
  privateKey?: string
  /** 密码短语 */
  passphrase?: string
  /** 是否启用 SFTP */
  enableSftp?: boolean
  /** 编码 */
  encoding?: string
  /** 退格模式 */
  backspaceMode?: string
  /** 算法 */
  algorithms?: Partial<AlgorithmPreferences>
  /** SSH keepalive 间隔（秒，0 = 关闭） */
  sshKeepaliveInterval?: number
}

/** Telnet 连接配置 */
export interface TelnetConnectConfig {
  /** 主机名 */
  host?: string
  /** 端口 */
  port?: number
  /** 编码 */
  encoding?: string
  /** 退格模式 */
  backspaceMode?: string
}

/** 串口连接配置 */
export interface SerialConnectConfig {
  /** 路径 */
  path?: string
  /** 波特率 */
  baudRate?: number
  /** 数据位 */
  dataBits?: number
  /** 停止位 */
  stopBits?: number
  /** 校验位 */
  parity?: string
  /** 编码 */
  encoding?: string
  /** 退格模式 */
  backspaceMode?: string
}

/** 本机 Shell 连接配置 */
export interface LocalConnectConfig {
  /** Shell 可执行文件路径（空则系统默认） */
  shell?: string
  /** 工作目录（空则用户家目录） */
  cwd?: string
  /** 编码 */
  encoding?: string
  /** 退格模式 */
  backspaceMode?: string
  /** 初始列数 */
  cols?: number
  /** 初始行数 */
  rows?: number
}

/** 串口端口信息 */
export interface SerialPortInfo {
  /** 路径 */
  path?: string
  /** 制造商 */
  manufacturer?: string
  /** 序列号 */
  serialNumber?: string
  /** PnP ID */
  pnpId?: string
  /** 位置 ID */
  locationId?: string
  /** 供应商 ID */
  vendorId?: string
  /** 产品 ID */
  productId?: string
}

/** 窗口控制 API */
export interface ZauTermWindowApi {
  /** 最小化窗口 */
  minimize: () => void
  /** 最大化窗口 */
  maximize: () => void
  /** 关闭窗口 */
  close: () => void
  /**
   * 设置窗口背景颜色
   * @param hex 十六进制颜色值
   */
  setBackgroundColor: (hex: string) => void
  /** 
   * 监听窗口最大化事件
   * @param cb 回调函数，参数为是否最大化
   */
  onMaximized: (cb: (v: boolean) => void) => () => void
  /**
   * 是否最大化
   * @returns 是否最大化
   */
  isMaximized: () => Promise<IpcResult<{ maximized: boolean }>>
  /**
   * 滚轮缩放
   * @param deltaY 滚轮滚动量
   */
  zoomWheelStep: (deltaY: number) => void
}

/** SSH 连接 API */
export interface ZauTermSshApi {
  /** 
   * 连接 
   * @param id 会话 ID
   * @param config 连接配置
   * @returns 连接结果
   */
  connect: (id: string, config: SshConnectConfig) => Promise<IpcResult>
  /** 
   * 断开连接
   * @param id 会话 ID
   * @returns 断开连接结果
   */
  disconnect: (id: string) => Promise<IpcResult>
  /** 
   * 发送数据
   * @param id 会话 ID
   * @param data 数据
   * @param encoding 编码
   */
  sendData: (id: string, data: string, encoding?: string) => void
  /** 
   * 调整窗口大小
   * @param id 会话 ID
   * @param cols 列数
   * @param rows 行数
   */
  resize: (id: string, cols: number, rows: number) => void
  /** 
   * 监听数据事件
   * @param id 会话 ID
   * @param cb 回调函数，参数为数据
   */
  onData: (id: string, cb: (data: string) => void) => () => void
  /** 
   * 监听关闭事件
   * @param id 会话 ID
   * @param cb 回调函数，参数为关闭事件
   */
  onClose: (id: string, cb: () => void) => () => void
}

/** SFTP 连接 API */
export interface ZauTermSftpApi {
  /** 
   * 连接
   * @param id 会话 ID
   * @param config 连接配置
   * @returns 连接结果
   */
  connect: (id: string, config: SshConnectConfig) => Promise<IpcResult>
  /** 
   * 断开连接
   * @param id 会话 ID
   * @returns 断开连接结果
   */
  disconnect: (id: string) => Promise<IpcResult>
  /** 
   * 列出远程目录内容
   * @param id 会话 ID
   * @param remotePath 远程路径
   * @returns 目录内容
   */
  list: (id: string, remotePath: string) => Promise<IpcResult<{ items: SftpEntry[] }>>
  /** 
   * 下载远程文件
   * @param id 会话 ID
   * @param remotePath 远程路径
   * @param localPath 本地路径
   * @returns 下载结果
   */
  download: (id: string, remotePath: string, localPath: string) => Promise<IpcResult>
  /** 
   * 下载远程目录
   * @param id 会话 ID
   * @param remoteDir 远程目录
   * @param localDir 本地目录
   * @returns 下载结果
   */
  downloadDir: (id: string, remoteDir: string, localDir: string) => Promise<IpcResult>
  /** 
   * 上传本地文件到远程
   * @param id 会话 ID
   * @param localPath 本地路径
   * @param remotePath 远程路径
   * @returns 上传结果
   */
  upload: (id: string, localPath: string, remotePath: string) => Promise<IpcResult>
  /**
   * 上传内存中的文件内容到远程（Tauri 拖拽无本地路径时使用）
   * @param id 会话 ID
   * @param remotePath 远程路径
   * @param data 文件字节
   */
  uploadBytes?: (id: string, remotePath: string, data: Uint8Array) => Promise<IpcResult>
  /** 
   * 创建远程目录
   * @param id 会话 ID
   * @param remotePath 远程路径
   * @returns 创建结果
   */
  mkdir: (id: string, remotePath: string) => Promise<IpcResult>
  /** 
   * 删除远程文件或目录
   * @param id 会话 ID
   * @param remotePath 远程路径
   * @returns 删除结果
   */
  delete: (id: string, remotePath: string) => Promise<IpcResult>
  /** 
   * 重命名远程文件或目录
   * @param id 会话 ID
   * @param oldPath 旧路径
   * @param newPath 新路径
   * @returns 重命名结果
   */
  rename: (id: string, oldPath: string, newPath: string) => Promise<IpcResult>
  /** 
   * 监听上传 / 下载进度
   * @param id 会话 ID
   * @param cb 回调函数，参数为进度
   */
  onProgress: (id: string, cb: (progress: ZauTermProgress) => void) => () => void
}

/** Telnet 连接 API */
export interface ZauTermTelnetApi {
  /** 
   * 连接
   * @param id 会话 ID
   * @param config 连接配置
   * @returns 连接结果
   */
  connect: (id: string, config: TelnetConnectConfig) => Promise<IpcResult>
  /** 
   * 断开连接
   * @param id 会话 ID
   * @returns 断开连接结果
   */
  disconnect: (id: string) => Promise<IpcResult>
  /** 
   * 发送数据
   * @param id 会话 ID
   * @param data 数据
   * @param encoding 编码
   */
  sendData: (id: string, data: string, encoding?: string) => void
  /** 
   * 监听数据事件
   * @param id 会话 ID
   * @param cb 回调函数，参数为数据
   */
  onData: (id: string, cb: (data: string) => void) => () => void
  /** 
   * 监听关闭事件
   * @param id 会话 ID
   * @param cb 回调函数，参数为关闭事件
   */
  onClose: (id: string, cb: () => void) => () => void
}

/** 串口连接 API */
export interface ZauTermSerialApi {
  /** 
   * 列出串口端口
   * @returns 串口端口列表
   */
  listPorts: () => Promise<IpcResult<{ ports: SerialPortInfo[] }>>
  /** 
   * 连接
   * @param id 会话 ID
   * @param config 连接配置
   * @returns 连接结果
   */
  connect: (id: string, config: SerialConnectConfig) => Promise<IpcResult>
  /** 
   * 断开连接
   * @param id 会话 ID
   * @returns 断开连接结果
   */
  disconnect: (id: string) => Promise<IpcResult>
  /** 
   * 发送数据
   * @param id 会话 ID
   * @param data 数据
   * @param encoding 编码
   */
  sendData: (id: string, data: string, encoding?: string) => void
  /** 
   * 监听数据事件
   * @param id 会话 ID
   * @param cb 回调函数，参数为数据
   */
  onData: (id: string, cb: (data: string) => void) => () => void
  /** 
   * 监听关闭事件
   * @param id 会话 ID
   * @param cb 回调函数，参数为关闭事件
   */
  onClose: (id: string, cb: () => void) => () => void
}

/** 本机 Shell 连接 API */
export interface ZauTermLocalApi {
  /**
   * 连接
   * @param id 会话 ID
   * @param config 连接配置
   * @returns 连接结果
   */
  connect: (id: string, config: LocalConnectConfig) => Promise<IpcResult>
  /**
   * 断开连接
   * @param id 会话 ID
   * @returns 断开连接结果
   */
  disconnect: (id: string) => Promise<IpcResult>
  /**
   * 发送数据
   * @param id 会话 ID
   * @param data 数据
   * @param encoding 编码
   */
  sendData: (id: string, data: string, encoding?: string) => void
  /**
   * 调整窗口大小
   * @param id 会话 ID
   * @param cols 列数
   * @param rows 行数
   */
  resize: (id: string, cols: number, rows: number) => void
  /**
   * 监听数据事件
   * @param id 会话 ID
   * @param cb 回调函数，参数为数据
   */
  onData: (id: string, cb: (data: string) => void) => () => void
  /**
   * 监听关闭事件
   * @param id 会话 ID
   * @param cb 回调函数，参数为关闭事件
   */
  onClose: (id: string, cb: () => void) => () => void
}

/** 凭据 API */
export interface ZauTermCredentialsApi {
  /** 
   * 是否可用
   * @returns 是否可用
   */
  isAvailable: () => Promise<IpcResult<{ available: boolean }>>
  /** 
   * 获取凭据
   * @param savedId 保存的 ID
   * @returns 凭据
   */
  get: (savedId: string) => Promise<IpcResult<VaultGetContent>>
  /** 
   * 同步凭据
   * @param savedId 保存的 ID
   * @param partial 凭据部分
   * @returns 同步结果
   */
  sync: (savedId: string, partial: VaultSecretPartial) => Promise<IpcResult>
  /** 
   * 删除凭据
   * @param savedId 保存的 ID
   * @returns 删除结果
   */
  remove: (savedId: string) => Promise<IpcResult>
  /** 
   * 复制凭据
   * @param fromId 源 ID
   * @param toId 目标 ID
   * @returns 复制结果
   */
  duplicate: (fromId: string, toId: string) => Promise<IpcResult>
  /** 
   * 清空所有凭据
   * @returns 清空结果
   */
  clearAll: () => Promise<IpcResult>
}

/** 打开文件/目录对话框场景 */
export type ChooseOpenKind =
  | 'logSave'
  | 'sftpDownload'
  | 'sftpUploadFiles'
  | 'sftpUploadFolder'
  | 'importSessions'
  | 'importSettings'
  | 'privateKey'

/** 另存为对话框场景 */
export type SaveFileKind = 'terminalOutput' | 'sessions' | 'settings'

/** 打开文件/目录对话框结果 */
export type ChooseOpenResult = IpcContent & {
  /** 用户取消 */
  canceled?: boolean
  /** 单目录路径（logSave / sftpDownload） */
  path?: string
  /** 多文件路径（sftpUploadFiles） */
  paths?: string[]
  /** 目录内文件列表（sftpUploadFolder） */
  entries?: { path: string; relativePath: string }[]
  /** 单文件文本（importSessions / importSettings / privateKey） */
  content?: string
}

/** 本地路径 API */
export interface ZauTermPathsApi {
  /** 
   * 获取下载路径
   * @returns 下载路径
   */
  getDownloadsPath: () => Promise<IpcResult<{ path: string }>>
  /**
   * 打开文件/目录对话框
   * @param kind 场景类型
   * @returns 选择结果
   */
  chooseOpen: (kind: ChooseOpenKind) => Promise<IpcResult<ChooseOpenResult>>
  /** 
   * 验证日志目录
   * @param dir 目录
   * @returns 验证结果
   */
  validateLogDirectory: (dir: string) => Promise<IpcResult>
  /** 
   * 验证本地文件路径
   * @param filePath 文件路径
   * @param kind 文件类型
   * @returns 验证结果
   */
  validateLocalFilePath: (filePath: string, kind?: string) => Promise<IpcResult>
  /** 
   * 获取文件路径
   * @param file 文件
   * @returns 文件路径
   */
  getPathForFile: (file: File) => string
}

/** 保存 API */
export interface ZauTermSaveApi {
  /**
   * 另存为对话框并写入文件
   * @param kind 场景类型（terminalOutput / sessions / settings）
   * @param defaultName 默认文件名
   * @param content 文件内容
   * @returns 保存结果
   */
  saveFile: (kind: SaveFileKind, defaultName: string, content: string) => Promise<IpcResult<{ canceled?: boolean }>>
}

/** 日志 API */
export interface ZauTermLogApi {
  /** 
   * 写入日志
   * @param logDir 日志目录
   * @param sessionId 会话 ID
   * @param data 数据
   */
  write: (logDir: string, sessionId: string, data: string) => void
  /** 
   * 追加日志
   * @param logDir 日志目录
   * @param sessionId 会话 ID
   * @param data 数据
   */
  append: (logDir: string, sessionId: string, data: string) => void
}

/** 其它 API */
export interface ZauTermOthersApi {
  /** 
   * 设置 UI 语言
   * @param uiLanguage 语言
   */
  setUiLanguage: (uiLanguage: 'zh' | 'en') => void
  /** 
   * 获取应用版本号（与 package.json / 安装包一致）
   * @returns 应用版本号
   */
  getVersion: () => Promise<IpcResult<{ version: string }>>
  /**
   * 在系统默认浏览器中打开 http(s) 链接
   * @param url 目标 URL
   */
  openExternal: (url: string) => Promise<IpcResult>
  /** 清空已保存的 SSH 已知主机公钥 */
  clearKnownHosts: () => Promise<IpcResult>
  /** 清空本会话「仅信任一次」的临时主机公钥缓存 */
  clearSessionHostKeyCache: () => Promise<IpcResult>
}

/** 主 API */
export interface ZauTermApi {
  /** 本地路径 API */
  paths: ZauTermPathsApi
  /** 保存 API */
  save: ZauTermSaveApi
  /** 其它 API */
  others: ZauTermOthersApi
  /** 窗口控制 API */
  window: ZauTermWindowApi
  /** 凭据 API */
  credentials: ZauTermCredentialsApi
  /** 日志 API */
  log: ZauTermLogApi
  /** SSH API */
  ssh: ZauTermSshApi
  /** SFTP API */
  sftp: ZauTermSftpApi
  /** Telnet API */
  telnet: ZauTermTelnetApi
  /** 串口 API */
  serial: ZauTermSerialApi
  /** 本机 Shell API */
  local: ZauTermLocalApi
}
