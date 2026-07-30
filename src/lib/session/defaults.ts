import type { SessionFormValues, SessionType } from '../../types/session'
import { DEFAULT_TERMINAL_ENCODING } from '../../../shared/terminalEncoding'

/** 端口最小值 */
export const PORT_MIN = 0
/** 端口最大值 */
export const PORT_MAX = 65535
/** 会话类型列表 */
export const SESSION_TYPES = ['ssh', 'telnet', 'serial']
/** 会话类型集合（用于快速判断是否为合法会话类型） */
export const SESSION_TYPE_SET = new Set(SESSION_TYPES)
/** SSH 认证类型列表 */
export const AUTH_TYPES = ['password', 'privateKey']
/** SSH 认证类型集合（用于快速判断是否为合法认证类型） */
export const AUTH_TYPE_SET = new Set(AUTH_TYPES)

/** 串口波特率列表 */
export const BAUD_RATES = [ '110', '300', '600', '1200', '2400', '4800', '9600', '14400', '19200', '38400', '57600', '115200', '128000', '256000',]
/** 串口波特率集合（用于快速判断是否为合法波特率） */
export const BAUD_RATE_SET = new Set(BAUD_RATES)
/** 串口校验位列表 */
export const PARITIES = ['none', 'even', 'odd', 'mark', 'space']
/** 串口校验位集合（用于快速判断是否为合法校验位） */
export const PARITY_SET = new Set(PARITIES)

/** 各会话类型允许持久化到 localStorage 的字段 */
export const SESSION_TYPE_FIELDS = {
  ssh: ['host', 'port', 'username', 'authType', 'enableSftp', 'encoding', 'backspaceMode'],
  telnet: ['host', 'port', 'encoding', 'backspaceMode'],
  serial: ['path', 'baudRate', 'dataBits', 'stopBits', 'parity', 'encoding', 'backspaceMode'],
}

/** 验证会话分组和标签返回码 → connect.* i18n 键 */
export const SESSION_GROUP_LABEL_ERROR_KEYS = {
  groupSlashStart: 'connect.errGroupSlashStart',
  groupSlashEnd: 'connect.errGroupSlashEnd',
  groupIllegalChars: 'connect.errGroupChars',
  labelIllegalChars: 'connect.errLabelChars',
}

/** ssh 会话默认值（数值字段为 number；表单绑定经 getSessionFormDefaults 转为字符串） */
export const SSH_SESSION_DEFAULT = {
  label: '',
  group: '',
  host: '',
  port: 22,
  username: '',
  authType: 'password',
  password: '',
  privateKey: '',
  passphrase: '',
  enableSftp: false,
  encoding: DEFAULT_TERMINAL_ENCODING,
  backspaceMode: 'auto',
}

/** telnet 会话默认值 */
export const TELNET_SESSION_DEFAULT = {
  label: '',
  group: '',
  host: '',
  port: 23,
  encoding: DEFAULT_TERMINAL_ENCODING,
  backspaceMode: 'auto',
}

/** serial 会话默认值 */
export const SERIAL_SESSION_DEFAULT = {
  label: '',
  group: '',
  path: '',
  baudRate: 9600,
  dataBits: 8,
  stopBits: 1,
  parity: 'none',
  encoding: DEFAULT_TERMINAL_ENCODING,
  backspaceMode: 'auto',
}

/** SSH 会话保存/导入时的数值型默认值 */
export type SshStorageDefaults = typeof SSH_SESSION_DEFAULT
/** Telnet 会话保存/导入时的数值型默认值 */
export type TelnetStorageDefaults = typeof TELNET_SESSION_DEFAULT
/** Serial 会话保存/导入时的数值型默认值 */
export type SerialStorageDefaults = typeof SERIAL_SESSION_DEFAULT
/** 会话保存/导入时的数值型默认值 */
export type SessionStorageDefaults = SshStorageDefaults | TelnetStorageDefaults | SerialStorageDefaults

/**
 * 获取会话保存/导入时的数值型默认值
 * @param type 会话类型
 * @returns 返回会话保存/导入时的数值型默认值
 */
export function getSessionStorageDefaults(type: SessionType): SessionStorageDefaults {
  if (type === 'ssh') return { ...SSH_SESSION_DEFAULT }
  if (type === 'telnet') return { ...TELNET_SESSION_DEFAULT }
  return { ...SERIAL_SESSION_DEFAULT }
}

/**
 * 获取会话连接对话框表单默认值（端口等为字符串，便于输入框绑定）
 * @param type 会话类型
 * @returns 返回会话连接对话框表单默认值
 */
export function getSessionFormDefaults(type: SessionType): SessionFormValues {
  /** 表单输入框绑定时需为字符串的数值字段，与 SESSION_TYPE_FIELDS 对应 */
  const SESSION_FORM_NUMERIC_KEYS: Record<SessionType, (keyof SessionFormValues)[]> = {
    ssh: ['port'],
    telnet: ['port'],
    serial: ['baudRate', 'dataBits', 'stopBits'],
  }
  const out = { ...getSessionStorageDefaults(type) } as SessionFormValues
  for (const key of SESSION_FORM_NUMERIC_KEYS[type] ?? []) {
    const v = out[key]
    if (typeof v === 'number') {
      if (key === 'port') out.port = String(v)
      else if (key === 'baudRate') out.baudRate = String(v)
      else if (key === 'dataBits') out.dataBits = String(v)
      else if (key === 'stopBits') out.stopBits = String(v)
    }
  }
  return out
}
