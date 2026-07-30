import { DEFAULT_ALGORITHM_SELECTION } from '../../../shared/sshAlgorithmDefaults'
import { DEFAULT_TERMINAL_FONT_FAMILY } from '../../../shared/terminalFonts'
import type { AppSettings } from '../../types/settings'

/** 主界面左侧会话栏默认宽度（px），与 App 分割条逻辑一致 */
export const DEFAULT_SIDEBAR_WIDTH = 300

/** xterm 滚动缓冲区行数默认值 */
export const TERMINAL_SCROLLBACK_DEFAULT = 20_000
/** xterm 滚动缓冲区行数最小值 */
export const TERMINAL_SCROLLBACK_MIN = 0
/** xterm 滚动缓冲区行数最大值 */
export const TERMINAL_SCROLLBACK_MAX = 500_000

/** SSH keepalive 间隔默认值（秒，0 = 关闭） */
export const SSH_KEEPALIVE_INTERVAL_DEFAULT = 0
/** SSH keepalive 间隔最小值（秒） */
export const SSH_KEEPALIVE_INTERVAL_MIN = 0
/** SSH keepalive 间隔最大值（秒） */
export const SSH_KEEPALIVE_INTERVAL_MAX = 600

/** SSH 算法子类别（与 settings.algo.* i18n 及 algorithmPreferences 键对应） */
export const SSH_ALGORITHM_SECTION_KEYS = ['kex', 'serverHostKey', 'cipher', 'hmac', 'compress']

/** 默认设置项 */
export const DEFAULT_SETTINGS: AppSettings = {
  /** 应用界面主题：dark | light | auto（跟随系统亮暗） */
  appTheme: 'auto',
  /** 界面语言：auto 跟随系统 | zh 简体中文 | en English */
  uiLanguage: 'auto',
  confirmDeleteSession: true,
  confirmDeleteGroup: true,
  deleteGroupWithSessions: false,
  terminalInteract: true,
  terminalFontFamily: DEFAULT_TERMINAL_FONT_FAMILY,
  terminalScrollback: TERMINAL_SCROLLBACK_DEFAULT,
  loggingMode: 'none',
  logPath: '',
  highlightRules: [
    { id: 'default1_error', name: 'default1_error', enabled: true, useRegex: true, caseSensitive: false, pattern: '(\\berror\\b)|(\\bfailed\\b)|(\\bdenied\\b)|(\\bunauthorized\\b)|(\\bdown\\b)', color: '#f1250e' },
    { id: 'default2_success', name: 'default2_success', enabled: true, useRegex: true, caseSensitive: false, pattern: '(\\bsuccess\\b)|(\\bconnected\\b)|(\\bready\\b)|(\\bok\\b)|(\\bup\\b)', color: '#4ade80' },
    { id: 'default3_warning', name: 'default3_warning', enabled: true, useRegex: true, caseSensitive: false, pattern: '(\\bwarning\\b)|(\\bnotice\\b)|(\\binfo\\b)|(\\bdebug\\b)|(\\bdisabled\\b)', color: '#f1c40f' },
    { id: 'default4_ip', name: 'default4_ip', enabled: true, useRegex: true, caseSensitive: false, pattern: '\\b(?:(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)\\.){3}(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)\\b', color: '#c717d3' },
  ],
  algorithmPreferences: DEFAULT_ALGORITHM_SELECTION,
  /** SSH 层 keepalive 间隔（秒，0 = 关闭；新连接生效） */
  sshKeepaliveInterval: SSH_KEEPALIVE_INTERVAL_DEFAULT,
  saveSecretsToVault: false,
  sidebarWidth: DEFAULT_SIDEBAR_WIDTH,
}
