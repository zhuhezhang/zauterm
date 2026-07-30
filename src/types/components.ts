import type { CSSProperties, Dispatch, DragEvent, MouseEvent, ReactNode, RefObject, SetStateAction } from 'react'
import type { TerminalFontFamilyKey } from '../../shared/terminalFonts'
import type { AppTheme, AppSettings } from './settings'
import type {
  ActiveSession, SavedSession, SessionConfig, SessionFormValues, SessionTreeNode as TreeNode,
  SessionType, TerminalClearFn, TerminalOpenSearchFn, TerminalTextGetter, BackspaceMode,
} from './session'

/** 应用主组件的属性 */
export interface AppMainProps {
  /** 设置 */
  settings: AppSettings
  /** 设置回调函数 */
  setSettings: Dispatch<SetStateAction<AppSettings>>
}

/** 错误边界组件的属性 */
export interface ErrorBoundaryProps {
  /** 子组件 */
  children: ReactNode
}

/** 错误边界组件的状态 */
export interface ErrorBoundaryState {
  /** 错误 */
  error: Error | null
}

/** 连接对话框的属性 */
export interface ConnectDialogProps {
  /** 初始协议类型（ssh/telnet/serial） */
  type: SessionType
  /** 初始配置数据，用于编辑已保存会话时预填充表单 */
  initialData: SessionConfig | null
  /** 已保存的分组列表，用于分组输入的自动补全 */
  savedGroups: string[]
  /** 直接连接的回调函数，参数为配置对象 */
  onConnect: (config: SessionConfig) => void
  /** 保存并连接的回调函数，参数为配置对象 */
  onSaveAndConnect: (config: SessionConfig) => void | Promise<void>
  /** 仅保存的回调函数，参数为配置对象 */
  onSaveOnly: (config: SessionConfig) => void | Promise<void>
  /** 关闭对话框的回调函数 */
  onClose: () => void
}

/** ConnectDialog 内嵌凭据补全弹层状态 */
export interface ConnectCredDialogState {
  /** 用户名 */
  username: string
  /** 密码 */
  password: string
  /** 私钥 */
  privateKey: string
  /** 密码短语 */
  passphrase: string
  /** 回调函数，参数为 SessionConfig 类型 */
  callback: (config: SessionConfig) => void
}

/** 设置表单数据 */
export type SessionFormSetter = <K extends keyof SessionFormValues>(
  k: K,
  v: SessionFormValues[K],
) => void

/** SSH / Telnet 等协议共用的连接表单 props */
export interface SessionFormFieldsProps {
  /** 表单数据 */
  form: SessionFormValues
  /** 设置表单数据 */
  set: SessionFormSetter
  /** 为 false 时不渲染表单区块 */
  visible: boolean
  /** 输入框回车时触发（如保存并连接） */
  onEnter?: () => void
}

/** Serial 连接表单 props（路径须与枚举列表一致方可连接） */
export interface SerialFormProps extends SessionFormFieldsProps {
  /** 可用串口列表，用于 datalist 自动补全 */
  ports: { path?: string; manufacturer?: string }[]
  /** 重新枚举串口 */
  onRefreshPorts: () => void
}

/** 标签栏的属性 */
export interface TabBarProps {
  /** 会话列表 */
  sessions: ActiveSession[]
  /** 当前活跃标签页的 ID */
  activeId: string | null
  /** 选择标签页的回调函数，参数为标签页 ID */
  onSelect: (id: string) => void
  /** 关闭标签页的回调函数，参数为标签页 ID */
  onClose: (id: string) => void
  /** 新建标签页的回调函数 */
  onNew: () => void
  /** 重新排序标签页的回调函数，参数为源标签页 ID 和目标标签页 ID */
  onReorder: (fromId: string, toId: string) => void
  /** 保存标签页输出的回调函数，参数为标签页 ID */
  onSaveOutput: (sessionId: string) => void | Promise<void>
  /** 清屏的回调函数，参数为标签页 ID */
  onClearScreen?: (sessionId: string) => void
  /** 切换退格键模式的回调函数，参数为标签页 ID 与模式 */
  onSetBackspaceMode?: (sessionId: string, mode: BackspaceMode) => void
  /** 搜索终端内容的回调函数，参数为标签页 ID（仅当前 active 标签可用） */
  onSearchTerminal?: (sessionId: string) => void
}

/** 标签栏右键菜单状态 */
export interface TabContextMenu {
  /** 菜单位置 x */
  x: number
  /** 菜单位置 y */
  y: number
  /** 会话 ID */
  id: string
  /** 会话索引 */
  idx: number
}

/** 终端面板的属性 */
export interface TerminalPanelProps {
  /** 会话对象，包含连接信息和状态 */
  session: ActiveSession
  /** 是否为当前活跃标签页 */
  active: boolean
  /** 更新会话状态的回调函数，参数为会话对象的更新部分 */
  onUpdate: (updates: Partial<ActiveSession>) => void
  /** 终端设置对象，包含用户偏好设置 */
  settings: AppSettings
  /** 应用亮暗（与界面 CSS 变量一致），用于 xterm 配色 */
  appThemeEffective?: 'dark' | 'light'
  /** 注册导出终端输出函数的回调函数，参数为 (sessionId, getter|null) */
  onRegisterExport: (sessionId: string, getter: TerminalTextGetter | null) => void
  /** 注册清屏函数的回调函数，参数为 (sessionId, fn|null) */
  onRegisterClearScreen?: (sessionId: string, fn: TerminalClearFn | null) => void
  /** 注册打开终端搜索栏的回调函数，参数为 (sessionId, fn|null) */
  onRegisterOpenSearch?: (sessionId: string, fn: TerminalOpenSearchFn | null) => void
}

/** 凭证对话框的属性 */
export interface CredentialDialogProps {
  /** 用户名 */
  username?: string
  /** 密码 */
  password?: string
  /** 私钥 */
  privateKey?: string
  /** 密码 */
  passphrase?: string
  /** 会话配置 */
  session: SessionConfig
  /** 是否保存凭证到 Vault */
  saveSecretsToVault: boolean
  /** 连接的回调函数，参数为用户名、密码、私钥和密码短语 */
  onConnect: (username: string, password: string, privateKey: string, passphrase: string) => void
  /** 保存并连接的回调函数，参数为用户名、密码、私钥和密码短语 */
  onSaveAndConnect: (
    username: string,
    password: string,
    privateKey: string,
    passphrase: string,
  ) => void | Promise<void>
  /** 关闭对话框的回调函数 */
  onClose: () => void
}

/** 欢迎屏幕的属性 */
export interface WelcomeScreenProps {
  /** 新建会话的回调函数，参数为协议类型 */
  onNewSession: (type?: SessionType) => void
}

/** 设置对话框的属性 */
export interface SettingsDialogProps {
  /** 设置 */
  settings: AppSettings
  /** 已保存的会话列表 */
  savedSessions: SavedSession[]
  /** 更新会话列表的回调函数，参数为会话列表和选项 */
  onUpdateSessions: (
    sessions: SavedSession[],
    options?: { placeholderForVacatedGroup?: string },
  ) => void
  /** 更新分组占位符的回调函数，参数为分组占位符列表 */
  onUpdatePlaceholders: (placeholders: string[]) => void
  /** 预览应用主题的回调函数，参数为主题对象或 null */
  onAppThemePreview: (theme: AppTheme | null) => void
  /** 预览终端字体的回调函数，参数为 preset key 或 null（关闭预览） */
  onTerminalFontFamilyPreview: (font: TerminalFontFamilyKey | null) => void
  /** 关闭对话框的回调函数 */
  onClose: () => void
  /** 保存设置的回调函数，参数为设置 */
  onSave: (settings: AppSettings) => void
}

/** SFTP 远程文件项的属性 */
export interface SftpRemoteItem {
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
  /** 权限 */
  rights?: { user?: string; group?: string; other?: string }
}

/** SFTP 面板文件行右键菜单 */
export interface SftpFileContextMenu {
  /** 菜单位置 x */
  x: number
  /** 菜单位置 y */
  y: number
  /** 菜单项 */
  item: SftpRemoteItem
}

/** 侧边栏顶部的属性 */
export interface SidebarTopProps {
  /** 是否打开 */
  open: boolean
  /** 切换打开状态的回调函数 */
  onToggle: () => void
  /** 打开设置对话框的回调函数 */
  onOpenSettings: () => void
  /** 翻译函数，参数为路径和参数，返回翻译后的字符串 */
  t: (path: string, params?: Record<string, string | number>) => string
}

/** 文件夹图标的属性 */
export interface FolderIconProps {
  /** 是否打开 */
  open: boolean
}

/** SFTP 面板的属性 */
export interface SftpPanelProps {
  /** 会话对象，包含连接信息和状态 */
  session: ActiveSession
}

/** 侧边栏的属性 */
export interface SidebarProps {
  /** 是否打开侧边栏 */
  open: boolean
  /** 切换打开状态的回调函数 */
  onToggle: () => void
  /** 已保存的会话列表 */
  savedSessions: SavedSession[]
  /** 新建会话的回调函数，参数为协议类型和初始配置 */
  onNewSession: (type?: SessionType, initial?: SessionConfig | null) => void
  /** 连接会话的回调函数，参数为会话对象 */
  onConnectSaved: (session: SavedSession) => void
  /** 删除会话的回调函数，参数为会话 ID */
  onDeleteSaved: (savedId: string) => void
  /** 更新会话列表的回调函数，参数为会话列表和选项 */
  onUpdateSessions: (
    sessions: SavedSession[],
    options?: { placeholderForVacatedGroup?: string },
  ) => void
  /** 复制会话的回调函数，参数为会话 ID */
  onDuplicateSaved: (savedId: string) => void | Promise<void>
  /** 分组占位符列表 */
  groupPlaceholders: string[]
  /** 更新分组占位符的回调函数，参数为分组占位符列表 */
  onUpdatePlaceholders: (placeholders: string[]) => void
  /** 当前活动会话对象 */
  activeSession: ActiveSession | null
  /** 设置 */
  settings: AppSettings
  /** 打开设置对话框的回调函数 */
  onOpenSettings: () => void
  /** 侧边栏样式 */
  style?: CSSProperties
  /** 递增时请求聚焦「搜索已保存会话」输入框（配合全局 Cmd/Ctrl+F） */
  focusSessionSearchNonce?: number
}

/** 侧边栏上下文菜单的状态 */
export type SidebarContextMenuState =
  | { x: number; y: number; type: 'sessions-header'; data: null }
  | { x: number; y: number; type: 'session'; data: SavedSession }
  | { x: number; y: number; type: 'group'; data: string }

/** 会话树节点的属性 */
export interface SessionTreeNodeComponentProps {
  /** 节点对象，包含 id、type、name、path 和 children 属性 */
  node: TreeNode
  /** 节点深度，表示节点所在的层级 */
  depth: number
  /** 键盘焦点 ID */
  keyboardFocusId: string | null
  /** 当前打开的上下文菜单（用于保持目标行高亮） */
  contextMenu: SidebarContextMenuState | null
  /** 是否展开的回调函数，参数为路径 */
  isExp: (path: string) => boolean
  /** 切换展开状态的回调函数，参数为路径 */
  togExp: (path: string) => void
  /** 打开上下文菜单的回调函数，参数为事件、类型和数据 */
  openCtx: (e: MouseEvent, type: SidebarContextMenuState['type'], data: SidebarContextMenuState['data']) => void
  /** 连接会话的回调函数，参数为会话对象 */
  onConnectSaved: (session: SavedSession) => void
  /** 重命名状态，包含路径和新的名称 */
  renaming: string | null
  /** 重命名值，新的名称 */
  renameVal: string
  /** 设置重命名值的回调函数，参数为新的名称 */
  setRenameVal: (v: string) => void
  /** 设置重命名状态的回调函数，参数为路径和新的名称 */
  setRenaming: (v: string | null) => void
  /** 重命名分组的回调函数，参数为旧路径和新的名称 */
  renameGroup: (oldPath: string, newName: string) => void
  /** 重命名分组输入引用 */
  renameGroupInputRef: RefObject<HTMLInputElement | null>
  /** 重命名分组忽略 blur 引用（blur 事件也就是失去焦点事件） */
  ignoreRenameGroupBlurRef: RefObject<boolean>
  /** 重命名会话状态，包含会话 ID 和新的名称 */
  renamingSession: string | null
  /** 重命名会话值，新的名称 */
  renameSessionVal: string
  /** 设置重命名会话状态的回调函数，参数为会话 ID 和新的名称 */
  setRenamingSession: (v: string | null) => void
  /** 设置重命名会话值的回调函数，参数为新的名称 */
  setRenameSessionVal: (v: string) => void
  /** 重命名会话的回调函数，参数为会话 ID 和新的名称 */
  renameSession: (savedId: string, newLabel: string) => void
  /** 重命名会话输入引用 */
  renameSessionInputRef: RefObject<HTMLInputElement | null>
  /** 重命名会话忽略 blur 引用（blur 事件也就是失去焦点事件） */
  ignoreRenameSessionBlurRef: RefObject<boolean>
  /** 拖拽开始事件处理函数，参数为事件、ID 和类型 */
  dStart: (e: DragEvent, id: string, type: string) => void
  /** 拖拽结束事件处理函数 */
  dEnd: () => void
  /** 拖拽覆盖事件处理函数，参数为事件、ID 和区域 */
  dOver: (e: DragEvent, id: string, zone: string) => void
  /** 拖拽离开事件处理函数，参数为事件 */
  dLeave: (e: DragEvent) => void
  /** 拖拽到分组的回调函数，参数为事件和分组路径 */
  dropOnGroup: (e: DragEvent, groupPath: string) => void
  /** 拖拽到会话的回调函数，参数为事件、会话 ID 和分组路径 */
  dropOnSession: (e: DragEvent, sessId: string, groupPath: string) => void
  /** 是否是拖拽目标的回调函数，参数为 ID 和区域 */
  isDO: (id: string, zone: string) => boolean
}

/** 侧边栏上下文菜单的属性 */
export interface SidebarContextMenuProps {
  /** 上下文菜单状态 */
  ctx: SidebarContextMenuState
  /** 关闭上下文菜单的回调函数 */
  closeCtx: () => void
  /** 连接会话的回调函数，参数为会话对象 */
  onConnectSaved: (session: SavedSession) => void
  /** 新建会话的回调函数，参数为协议类型和初始配置 */
  onNewSession: (type?: SessionType, initial?: SessionConfig | null) => void
  /** 复制会话的回调函数，参数为会话 ID */
  dupSession: (id: string) => void
  /** 删除会话的回调函数，参数为会话 ID 和名称 */
  deleteSession: (id: string, label: string) => void
  /** 删除分组的回调函数，参数为分组路径 */
  deleteGroup: (path: string) => void
  /** 设置重命名状态的回调函数，参数为新的名称 */
  setRenaming: (v: string | null) => void
  /** 设置重命名值的回调函数，参数为新的名称 */
  setRenameVal: (v: string) => void
  /** 分组占位符列表 */
  groupPlaceholders: string[]
  /** 更新分组占位符的回调函数，参数为分组占位符列表 */
  onUpdatePlaceholders?: (placeholders: string[]) => void
  /** 展开所有分组的回调函数 */
  expandAll: () => void
  /** 折叠所有分组的回调函数 */
  collapseAll: () => void
  /** 展开所有分组的回调函数，参数为分组路径 */
  expandGroupAll: (groupPath: string) => void
  /** 折叠所有分组的回调函数，参数为分组路径 */
  collapseGroupAll: (groupPath: string) => void
  /** 设置重命名会话状态的回调函数，参数为会话 ID 和新的名称 */
  setRenamingSession: (v: string | null) => void
  /** 设置重命名会话值的回调函数，参数为新的名称 */
  setRenameSessionVal: (v: string) => void
  /** 已保存会话列表 */
  savedSessions: SavedSession[]
  /** 导入会话 */
  onImportSessions: () => void
}
