/** 会话类型与树结构领域模型 */
import type { Terminal } from '@xterm/xterm'

/** 会话类型枚举 */
export type SessionType = 'ssh' | 'telnet' | 'serial' | 'local'

/** 会话状态枚举 */
export type SessionStatus =
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'reconnecting'
  | 'error'

/** 退格键模式枚举 */
export type BackspaceMode = 'auto' | 'del' | 'bs'

/** 各会话类型共有的持久化字段 */
export interface SessionBase {
  /** 会话 ID */
  savedId: string
  /** 会话标签 */
  label: string
  /** 会话分组 */
  group: string
  /** 会话保存时间 */
  savedAt?: number
  /** 会话编码 */
  encoding?: string
  /** 退格键模式 */
  backspaceMode?: BackspaceMode | string
}

/** SSH 会话持久化字段 */
export interface SshSavedSession extends SessionBase {
  /** 会话类型 */
  type: 'ssh'
  /** 主机名 */
  host?: string
  /** 端口 */
  port?: number
  /** 用户名 */
  username?: string
  /** 认证类型 */
  authType?: string
  /** 是否启用 SFTP */
  enableSftp?: boolean
  /** 密码 */
  password?: string
  /** 私钥 */
  privateKey?: string
  /** 密码短语 */
  passphrase?: string
}

/** Telnet 会话持久化字段 */
export interface TelnetSavedSession extends SessionBase {
  /** 会话类型 */
  type: 'telnet'
  /** 主机名 */
  host?: string
  /** 端口 */
  port?: number
}

/** Serial 会话持久化字段 */
export interface SerialSavedSession extends SessionBase {
  /** 会话类型 */
  type: 'serial'
  /** 串口路径 */
  path?: string
  /** 波特率 */
  baudRate?: number
  /** 数据位 */
  dataBits?: number
  /** 停止位 */
  stopBits?: number
  /** 奇偶校验 */
  parity?: string
}

/** 本机 Shell 会话持久化字段 */
export interface LocalSavedSession extends SessionBase {
  /** 会话类型 */
  type: 'local'
  /** Shell 可执行文件路径（空则系统默认） */
  shell?: string
  /** 工作目录（空则用户家目录） */
  cwd?: string
}

/** localStorage 中已保存的会话 */
export type SavedSession = SshSavedSession | TelnetSavedSession | SerialSavedSession | LocalSavedSession

/** 活跃会话在 SavedSession 之上附加的运行时字段 */
export interface ActiveSessionFields {
  /** 会话 ID */
  id: string
  /** 会话状态 */
  status?: SessionStatus | string
  /** 是否打开 SFTP */
  sftpOpen?: boolean
  /** 是否连接 SFTP */
  sftpConnected?: boolean
  /** 是否准备好 SFTP */
  sftpReady?: boolean
  /** 远程路径 */
  remotePath?: string
  /** 错误消息 */
  errorMessage?: string
}

/** 活跃 SSH 会话 */
export type ActiveSshSession = SshSavedSession & ActiveSessionFields
/** 活跃 Telnet 会话 */
export type ActiveTelnetSession = TelnetSavedSession & ActiveSessionFields
/** 活跃 Serial 会话 */
export type ActiveSerialSession = SerialSavedSession & ActiveSessionFields
/** 活跃本机 Shell 会话 */
export type ActiveLocalSession = LocalSavedSession & ActiveSessionFields

/** 顶部标签页中的活跃会话 */
export type ActiveSession = ActiveSshSession | ActiveTelnetSession | ActiveSerialSession | ActiveLocalSession

/** 连接对话框 / 启动会话使用的配置（字段并集，便于表单与 IPC 传参） */
export interface SessionConfig {
  /** 会话 ID */
  id?: string
  /** 会话状态 */
  status?: SessionStatus | string
  /** 会话类型 */
  type?: SessionType | string
  /** 会话 ID */
  savedId?: string
  /** 会话保存时间 */
  savedAt?: number
  /** 会话标签 */
  label?: string
  /** 会话分组 */
  group?: string
  /** 会话编码 */
  encoding?: string
  /** 退格模式 */
  backspaceMode?: BackspaceMode | string
  /** 主机名 */
  host?: string
  /** 端口 */
  port?: number | string
  /** 用户名 */
  username?: string
  /** 认证类型 */
  authType?: string
  /** 是否启用 SFTP */
  enableSftp?: boolean
  /** 密码 */
  password?: string
  /** 私钥 */
  privateKey?: string
  /** 密码短语 */
  passphrase?: string
  /** 串口路径 */
  path?: string
  /** 波特率 */
  baudRate?: number | string
  /** 数据位 */
  dataBits?: number | string
  /** 停止位 */
  stopBits?: number | string
  /** 奇偶校验 */
  parity?: string
  /** Shell 可执行文件路径 */
  shell?: string
  /** 工作目录 */
  cwd?: string
}

/** 连接对话框表单字段（字符串/数值混用，便于 input 绑定） */
export interface SessionFormValues {
  /** 会话标签 */
  label?: string
  /** 会话分组 */
  group?: string
  /** 主机名 */
  host?: string
  /** 端口 */
  port?: string | number
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
  /** 会话编码 */
  encoding?: string
  /** 退格键模式 */
  backspaceMode?: string
  /** 串口路径 */
  path?: string
  /** 波特率 */
  baudRate?: string | number
  /** 数据位 */
  dataBits?: string | number
  /** 停止位 */
  stopBits?: string | number
  /** 奇偶校验 */
  parity?: string
  /** Shell 可执行文件路径 */
  shell?: string
  /** 工作目录 */
  cwd?: string
  /** 会话 ID */
  savedId?: string
  /** 会话类型 */
  type?: SessionType | string
}

/** 会话树节点 */
export interface SessionTreeSessionNode {
  /** 会话 ID */
  id: string
  /** 会话类型 */
  type: 'session'
  /** 会话名称 */
  name: string
  /** 会话配置 */
  session: SavedSession
}

/** 会话树组节点 */
export interface SessionTreeGroupNode {
  /** 会话 ID */
  id: string
  /** 会话类型 */
  type: 'group'
  /** 会话名称 */
  name: string
  /** 会话路径 */
  path: string
  /** 子节点 */
  children: SessionTreeNode[]
}

/** 会话树节点 */
export type SessionTreeNode = SessionTreeSessionNode | SessionTreeGroupNode

/** 扁平化树节点 */
export interface FlattenedTreeItem {
  /** 会话 ID */
  id: string
  /** 会话类型 */
  type: string
  /** 会话树节点 */
  node: SessionTreeNode
}

/** 凭据对话框状态 */
export interface CredentialDialogState {
  /** 用户名 */
  username?: string
  /** 密码 */
  password?: string
  /** 私钥 */
  privateKey?: string
  /** 密码短语 */
  passphrase?: string
  /** 会话配置 */
  session: SessionConfig
}

/** 终端文本获取器 */
export type TerminalTextGetter = () => string
/** 终端文本清除器 */
export type TerminalClearFn = () => void
/** 打开终端内容搜索栏 */
export type TerminalOpenSearchFn = () => void

/** 终端面板内会话日志控制器（buffer / stream 模式） */
export interface SessionLogHandle {
  /** 调度快照 */
  scheduleSnapshot?: () => void
  /** 入队 */
  enqueue?: (s: string) => void
  /** 立即刷新 */
  flushNow?: () => void
  /** 设置终端 */
  setTerminal?: (term: Terminal) => void
}

/** 会话分组/标签名校验错误码 */
export type SessionGroupLabelError =
  | 'groupSlashStart'
  | 'groupSlashEnd'
  | 'groupIllegalChars'
  | 'labelIllegalChars'

/** SSH 会话持久化字段 */
export type SshPickedFields = Omit<SshSavedSession, 'savedId' | 'savedAt'>
/** Telnet 会话持久化字段 */
export type TelnetPickedFields = Omit<TelnetSavedSession, 'savedId' | 'savedAt'>
/** Serial 会话持久化字段 */
export type SerialPickedFields = Omit<SerialSavedSession, 'savedId' | 'savedAt'>
/** Local 会话持久化字段 */
export type LocalPickedFields = Omit<LocalSavedSession, 'savedId' | 'savedAt'>

/** pickSessionStorageFields 写入 localStorage 的字段形状 */
export type PickedSessionFields = SshPickedFields | TelnetPickedFields | SerialPickedFields | LocalPickedFields

/** 导入 JSON 中的原始会话字段（校验前） */
export interface RawImportedSession {
  /** 会话类型 */
  type?: string
  /** 会话 ID */
  savedId?: string
  /** 会话保存时间 */
  savedAt?: string | number
  /** 会话分组 */
  group?: string
  /** 会话标签 */
  label?: string
  /** 主机名 */
  host?: string
  /** 端口 */
  path?: string
  /** 端口 */
  port?: string | number
  /** 用户名 */
  username?: string
  /** 认证类型 */
  authType?: string
  /** 是否启用 SFTP */
  enableSftp?: boolean | string | number
  /** 密码 */
  password?: string
  /** 私钥 */
  privateKey?: string
  /** 密码短语 */
  passphrase?: string
  /** 会话编码 */
  encoding?: string
  /** 退格键模式 */
  backspaceMode?: string
  /** 波特率 */
  baudRate?: string | number
  /** 数据位 */
  dataBits?: string | number
  /** 停止位 */
  stopBits?: string | number
  /** 奇偶校验 */
  parity?: string
  /** Shell 可执行文件路径 */
  shell?: string
  /** 工作目录 */
  cwd?: string
}

/** 会话连接端点（host、serial path 或 local shell） */
export function sessionEndpoint(session: SavedSession | ActiveSession | SessionConfig): string {
  if (session.type === 'serial') {
    return String('path' in session ? session.path ?? '' : '')
  }
  if (session.type === 'local') {
    const shell = 'shell' in session ? String(session.shell ?? '').trim() : ''
    return shell || 'localhost'
  }
  return String('host' in session ? session.host ?? '' : '')
}

/** SSH 会话是否启用 SFTP */
export function sessionHasSftp(session: SavedSession | ActiveSession | SessionConfig): boolean {
  return session.type === 'ssh' && Boolean(session.enableSftp)
}

/** 是否为 SSH 会话（类型守卫） */
export function isSshSession(session: SavedSession | ActiveSession | SessionConfig): session is SshSavedSession | ActiveSshSession {
  return session.type === 'ssh'
}
