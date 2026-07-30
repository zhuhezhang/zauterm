/** 渲染进程应用设置（localStorage）；algorithmPreferences 类型见 shared/sshAlgorithmDefaults */
import type { AlgorithmPreferences } from '../../shared/sshAlgorithmDefaults'
import type { TerminalFontFamilyKey } from '../../shared/terminalFonts'

/** 应用主题 */
export type AppTheme = 'dark' | 'light' | 'auto'
/** 界面语言 */
export type UiLanguageSetting = 'auto' | 'zh' | 'en'
/** 日志模式 */
export type LoggingMode = 'none' | 'stream' | 'buffer'
/** 高亮规则 */
export interface HighlightRule {
  /** 规则 ID */
  id: string
  /** 规则名称 */
  name: string
  /** 是否启用 */
  enabled: boolean
  /** 是否使用正则表达式 */
  useRegex: boolean
  /** 是否区分大小写 */
  caseSensitive: boolean
  /** 匹配模式 */
  pattern: string
  /** 颜色 */
  color: string
}

/** 与 DEFAULT_SETTINGS 对齐的应用设置 */
export interface AppSettings {
  /** 应用主题 */
  appTheme: AppTheme
  /** 界面语言 */
  uiLanguage: UiLanguageSetting
  /** 删除会话前确认 */
  confirmDeleteSession: boolean
  /** 删除分组前确认 */
  confirmDeleteGroup: boolean
  /** 删除分组时同时删除会话 */
  deleteGroupWithSessions: boolean
  /** 选中复制 / 右键粘贴 */
  terminalInteract: boolean
  /** 终端字体 preset key */
  terminalFontFamily: TerminalFontFamilyKey
  /** 终端滚动回退 */
  terminalScrollback: number
  /** 日志模式 */
  loggingMode: LoggingMode
  /** 日志路径 */
  logPath: string
  /** 高亮规则 */
  highlightRules: HighlightRule[]
  /** SSH/SFTP 算法 */
  algorithmPreferences: AlgorithmPreferences
  /** SSH keepalive 间隔（秒，0 = 关闭） */
  sshKeepaliveInterval: number
  /** 保存凭据到加密存储 */
  saveSecretsToVault: boolean
  /** 侧边栏宽度 */
  sidebarWidth: number
}

/** 设置对话框标签页 key（与 SETTINGS_TAB_SECTION_IDS 一致） */
export type SettingsTabKey = 'general' | 'ssh-terminal' | 'data-security'

/** 设置对话框操作 key */
export type SettingsActionKey =
  | 'resetAlgorithmPreferences'
  | 'resetHighlightRules'
  | 'addHighlightRule'
  | 'clearVault'
  | 'clearKnownHosts'
  | 'exportSessions'
  | 'importSessions'
  | 'clearAllSessions'
  | 'exportSettings'
  | 'importSettings'
  | 'restoreDefaultSettings'

/** 设置对话框悬浮提示 */
export interface SettingsHoverTip {
  /** 提示文本 */
  text: string
  /** 提示位置 x */
  x: number
  /** 提示位置 y */
  y: number
}

/** 设置对话框表单项 */
export interface SettingsSchemaItem {
  /** 表单项 key */
  key?: keyof AppSettings & string
  /** 表单项操作 */
  action?: SettingsActionKey
  /** 表单项标签 */
  type?: string
  /** 表单项标签 key */
  labelKey?: string
  /** 表单项描述 key */
  descKey?: string
  /** 表单项按钮 key */
  buttonKey?: string
  /** 表单项危险操作 */
  danger?: boolean
  /** 表单项最小值 */
  min?: number
  /** 表单项最大值 */
  max?: number
  /** 表单项步长 */
  step?: number
  /** 表单项选项 */
  options?: { value: string; labelKey: string }[]
}

/** 设置对话框区块头定义 */
export interface SettingsSectionHeaderDef {
  /** 表单项标签 key */
  labelKey: string
  /** 表单项描述 key */
  descKey?: string
  /** 表单项操作 */
  actions?: { action: SettingsActionKey; buttonKey: string }[]
}

/** 设置对话框算法区块定义 */
export interface SettingsAlgorithmSectionDef {
  /** 区块 key */
  section: string
  /** 区块头定义 */
  header?: SettingsSectionHeaderDef
}

/** 设置对话框通用区块定义 */
export interface SettingsGenericSectionDef {
  /** 区块 key */
  section: string
  /** 区块类型 */
  kind?: string
  /** 表单项列表 */
  items?: SettingsSchemaItem[]
  /** 区块头定义 */
  header?: SettingsSectionHeaderDef
}
