import type {
  BackspaceMode,
  PickedSessionFields,
  RawImportedSession,
  SerialSavedSession,
  SessionConfig,
  SessionFormValues,
  SessionGroupLabelError,
  SessionType,
} from '../../types/session'
import {
  PORT_MIN,
  PORT_MAX,
  SESSION_TYPE_FIELDS,
  BAUD_RATE_SET,
  PARITY_SET,
  getSessionFormDefaults,
} from './defaults'
import type { SerialStorageDefaults } from './defaults'
import { INVALID_LABEL_CHARS } from '../../../shared/others'
import { hasInvalidLabelChars, hasInvalidGroupChars } from '../safeFileName'

/**
 * 规范化退格模式
 * @param v 退格模式
 * @returns 返回规范化后的退格模式
 */
export function normalizeBackspaceMode(v: string | number | boolean | null | undefined): BackspaceMode | null {
  const s = String(v ?? '').toLowerCase()
  return s === 'auto' || s === 'del' || s === 'bs' ? s : null
}

/**
 * 限制端口字段字符串
 * @param raw 端口字段字符串
 * @returns 返回限制后的端口字段字符串
 */
export function clampPortFieldString(raw: string | number | null | undefined): string {
  const s = String(raw ?? '').trim()
  if (s === '') return ''
  const n = parseInt(s, 10)
  if (Number.isNaN(n)) return ''
  return String(Math.min(PORT_MAX, Math.max(PORT_MIN, n)))
}

/**
 * 限制会话端口
 * @param raw 端口字段字符串
 * @param fallback 默认端口
 * @returns 返回限制后的端口
 */
export function clampSessionPort(raw: string | number | null | undefined, fallback: number): number {
  if (raw === '' || raw == null) return fallback
  const n = typeof raw === 'number' ? raw : parseInt(String(raw), 10)
  if (!Number.isFinite(n)) return fallback
  return Math.min(PORT_MAX, Math.max(PORT_MIN, n))
}

/**
 * 解析会话端口
 * @param raw 端口字段字符串
 * @returns 返回解析后的端口
 */
export function parseSessionPort(raw: string | number | null | undefined): number | undefined {
  const s = String(raw ?? '').trim()
  if (s === '') return undefined
  const n = parseInt(s, 10)
  if (!Number.isFinite(n)) return undefined
  return Math.min(PORT_MAX, Math.max(PORT_MIN, n))
}

/**
 * 构建会话标签
 * @param tab 会话类型或字符串
 * @param form 会话表单值
 * @returns 返回构建后的会话标签
 */
export function buildSessionLabel(
  tab: SessionType | string,
  form: SessionFormValues,
): string {
  if (tab === 'serial') {
    const raw = String(form.path || 'Serial')
    return raw.replace(INVALID_LABEL_CHARS, '').trim() || 'Serial'
  }
  if (tab === 'telnet') {
    const raw = String(form.host || 'Telnet')
    return raw.replace(INVALID_LABEL_CHARS, '').trim() || 'Telnet'
  }
  const raw =
    (form.username ? String(form.username) + '@' : '') +
    (form.host || String(tab).toUpperCase())
  return raw.replace(INVALID_LABEL_CHARS, '').trim() || String(tab).toUpperCase()
}

/**
 * 验证会话分组标签
 * @param group 分组标签
 * @param label 标签
 * @returns 返回验证后的会话分组标签
 */
export function validateSessionGroupLabel(
  group?: string,
  label?: string,
): SessionGroupLabelError | null {
  const g = group ?? ''
  const l = label ?? ''
  if (g.startsWith('/')) return 'groupSlashStart'
  if (g.endsWith('/')) return 'groupSlashEnd'
  if (g && hasInvalidGroupChars(g)) return 'groupIllegalChars'
  if (l && hasInvalidLabelChars(l)) return 'labelIllegalChars'
  return null
}

/**
 * 合并会话表单默认值
 * @param tab 会话类型或字符串
 * @param initial 初始会话表单值
 * @returns 返回合并后的会话表单值
 */
export function mergeSessionFormDefaults(
  tab: SessionType | string,
  initial?: SessionConfig | SessionFormValues,
): SessionFormValues {
  const base = getSessionFormDefaults(tab as SessionType)
  const merged: SessionFormValues = initial ? { ...base, ...initial } : { ...base }
  merged.backspaceMode = normalizeBackspaceMode(merged.backspaceMode) ?? 'auto'
  return merged
}

/**
 * 选择会话存储字段
 * @param config 会话配置
 * @returns 返回选择后的会话存储字段
 */
export function pickSessionStorageFields(config: SessionConfig): PickedSessionFields {
  const type = (config?.type ?? 'ssh') as SessionType
  const allowed =
    SESSION_TYPE_FIELDS[type as keyof typeof SESSION_TYPE_FIELDS] ?? []
  const picked: Record<string, string | number | boolean> = {}
  for (const key of allowed) {
    const v = config[key as keyof SessionConfig]
    if (v !== undefined && (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')) {
      picked[key] = v
    }
  }
  return {
    type,
    label: String(config.label ?? ''),
    group: String(config.group ?? ''),
    ...picked,
  } as PickedSessionFields
}

/**
 * 应用 Serial 存储字段
 * @param merged 合并的 Serial 存储字段
 * @param item 原始会话对象
 * @param base 默认值
 */
export function applySerialStorageFields(
  merged: Partial<SerialSavedSession>,
  item: RawImportedSession,
  base: SerialStorageDefaults,
): void {
  merged.path = String(item.path).trim()
  const baud = parseInt(String(item.baudRate ?? base.baudRate), 10)
  merged.baudRate = Number.isFinite(baud) ? baud : base.baudRate
  const dataBits = parseInt(String(item.dataBits ?? base.dataBits), 10)
  merged.dataBits = Number.isFinite(dataBits) ? dataBits : base.dataBits
  const stopBits = parseInt(String(item.stopBits ?? base.stopBits), 10)
  merged.stopBits = Number.isFinite(stopBits) ? stopBits : base.stopBits
  const parity = String(item.parity ?? base.parity).toLowerCase()
  merged.parity = PARITY_SET.has(parity) ? parity : 'none'
  if (!BAUD_RATE_SET.has(String(merged.baudRate))) {
    merged.baudRate = base.baudRate
  }
}
