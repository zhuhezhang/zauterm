import type { VaultSecretPartial } from '../../shared/zterm-api.js'
import type { AppSettings } from '../types/settings'
import type { SavedSession, SessionConfig, SshSavedSession } from '../types/session'
import { isSshSession } from '../types/session'
import type { IpcResult } from '../../shared/ipc'
import { vaultSecretsFromGetResponse } from '../lib/ipc/ipcResponse'

/** 加密存储同步载荷（空对象表示不修改 vault） */
type VaultSecretPayload = VaultSecretPartial

/**
 * 构建加密存储同步载荷
 * @param config 会话配置
 * @param settings 应用设置
 * @returns 加密存储同步载荷
 */
export function buildSecretsSyncPayload(config: SessionConfig, settings: AppSettings): VaultSecretPayload {
  if (!settings.saveSecretsToVault) return {}
  const keys: VaultSecretPayload = { password: null, privateKey: null, passphrase: null }
  if (config.type === 'ssh') {
    keys.password = typeof config.password === 'string' && config.password ? config.password : null
    keys.privateKey = typeof config.privateKey === 'string' && config.privateKey ? config.privateKey : null
    keys.passphrase = typeof config.passphrase === 'string' && config.passphrase ? config.passphrase : null
  }
  return keys
}

/**
 * 同步会话凭据到加密存储
 * @param savedId 保存的 ID
 * @param config 会话配置
 * @param settings 应用设置
 * @returns 同步结果
 */
export async function syncSessionSecretsToVault(
  savedId: string,
  config: SessionConfig,
  settings: AppSettings,
): Promise<IpcResult | null> {
  const api = window.zterm?.credentials
  if (!savedId || typeof savedId !== 'string') return null
  if (!api?.sync || !settings.saveSecretsToVault) return null
  const partial = buildSecretsSyncPayload(config, settings)
  if (!Object.keys(partial).length) return null
  return api.sync(savedId, partial)
}

/**
 * 从加密存储获取会话凭据
 * @param savedId 保存的 ID
 * @returns 会话凭据
 */
export async function fetchSessionSecrets(savedId: string): Promise<VaultSecretPartial> {
  const api = window.zterm?.credentials
  if (!savedId || !api?.get) return {}
  try {
    const res = await api.get(savedId)
    return vaultSecretsFromGetResponse(res)
  } catch {
    return {}
  }
}

/**
 * 合并会话凭据到加密存储
 * @param session 会话配置
 * @returns 合并后的会话配置
 */
export async function mergeSessionWithVaultSecrets<T extends SessionConfig>(session: T): Promise<T> {
  if (!session?.savedId || typeof session.savedId !== 'string') return session
  const sec = await fetchSessionSecrets(session.savedId)
  return { ...session, ...sec }
}

/**
 * 删除加密存储凭据
 * @param savedId 保存的 ID
 */
export async function removeVaultEntry(savedId: string): Promise<void> {
  await window.zterm?.credentials?.remove?.(savedId)
}

/**
 * 复制加密存储凭据
 * @param fromId 源 ID
 * @param toId 目标 ID
 */
export async function duplicateVaultEntry(fromId: string, toId: string): Promise<void> {
  await window.zterm?.credentials?.duplicate?.(fromId, toId)
}

/**
 * 清空所有加密存储凭据
 */
export async function clearAllVaultEntries(): Promise<void> {
  await window.zterm?.credentials?.clearAll?.()
}

/**
 * 重新应用加密存储策略到所有会话
 * @param savedSessions 保存的会话
 * @param settings 应用设置
 */
export async function reapplyVaultPoliciesForAllSessions(
  savedSessions: SavedSession[],
  settings: AppSettings,
): Promise<void> {
  if (!settings.saveSecretsToVault) return
  const api = window.zterm?.credentials
  if (!api?.get || !api?.sync) return
  const availRes = await api.isAvailable?.()
  if (!availRes?.success || availRes.content?.available === false) return

  for (const s of savedSessions) {
    if (!s.savedId || !isSshSession(s)) continue
    const sec = await fetchSessionSecrets(s.savedId)
    const full: SessionConfig = { ...s }
    if (sec.password) full.password = sec.password
    if (sec.privateKey) full.privateKey = sec.privateKey
    if (sec.passphrase) full.passphrase = sec.passphrase
    await api.sync(s.savedId, buildSecretsSyncPayload(full, settings))
  }
}

/**
 * 解析受影响的保存 ID
 * @param prevSessions 之前的会话
 * @param nextSessions 之后的会话
 * @param config 会话配置
 * @returns 受影响的保存 ID
 */
export function resolveAffectedSavedId(
  prevSessions: SavedSession[],
  nextSessions: SavedSession[],
  config: SessionConfig,
): string | null {
  if (typeof config?.savedId === 'string' && config.savedId) return config.savedId
  const prevIds = new Set(prevSessions.map((s) => s.savedId))
  const added = nextSessions.find((s) => s.savedId && !prevIds.has(s.savedId))
  return added?.savedId || null
}

/**
 * 从导入的会话中吸收明文凭据
 * @param sessions 会话配置
 * @returns 吸收明文凭据后的会话配置
 */
export async function absorbPlaintextSecretsFromImportedSessions(
  sessions: SavedSession[],
): Promise<SavedSession[]> {
  const api = window.zterm?.credentials
  const availRes = api?.isAvailable ? await api.isAvailable() : null
  const avail = availRes?.success && availRes.content?.available === true
  const out: SavedSession[] = []

  for (const s of sessions) {
    const copy: SavedSession = { ...s }
    if (avail && api?.sync && s.savedId && isSshSession(s)) {
      const partial: VaultSecretPartial = {}
      if (typeof s.password === 'string' && s.password) partial.password = s.password
      if (typeof s.privateKey === 'string' && s.privateKey) partial.privateKey = s.privateKey
      if (typeof s.passphrase === 'string' && s.passphrase) partial.passphrase = s.passphrase
      if (Object.keys(partial).length) await api.sync(s.savedId, partial)
      const sshCopy = copy as SshSavedSession
      delete sshCopy.password
      delete sshCopy.privateKey
      delete sshCopy.passphrase
    }
    out.push(copy)
  }

  return out
}
