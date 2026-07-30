import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react'
import type { AppSettings } from '@/types/settings'
import { sessionEndpoint } from '@/types/session'
import type { IpcResult } from '../../shared/ipc'
import { useI18n } from '@/context/I18nContext'
import { alertIpcFailure } from '@/lib/ipc/formatIpcError'
import { fileTimestamp } from '@/lib/util/fileTimestamp'
import { safeFileToken } from '@/lib/safeFileName'
import { prepareSavedSessionUpdate } from '@/lib/session/persistSavedSession'
import { normalizeBackspaceMode } from '@/lib/session/utils'
import {
  loadSavedSessions, removeSavedSession, duplicateSavedSession, saveSessions, getGroups,
  loadGroupPlaceholders, saveGroupPlaceholders, addGroupPlaceholder, prunePlaceholdersForOccupiedGroups,
  vacatedNamedGroupIfEmpty,
} from '@/store/sessionStore'
import {
  syncSessionSecretsToVault, resolveAffectedSavedId, mergeSessionWithVaultSecrets,
  removeVaultEntry, duplicateVaultEntry,
} from '@/store/credentialsBridge'
import type {
  ActiveSession,
  BackspaceMode,
  CredentialDialogState,
  SavedSession,
  SessionConfig,
  SessionType,
  TerminalClearFn,
  TerminalOpenSearchFn,
  TerminalTextGetter,
} from '@/types/session'

/**
 * 打开凭据对话框
 * @param merged 合并的会话配置
 * @returns 凭据对话框状态
 */
function openCredentialDialog(merged: SessionConfig): CredentialDialogState {
  return {
    session: merged,
    username: merged.username || '',
    password: merged.password || '',
    privateKey: merged.privateKey || '',
    passphrase: merged.passphrase || '',
  }
}

/** Session 上下文值 */
export interface SessionContextValue {
  /** 会话列表 */
  sessions: ActiveSession[]
  /** 当前活跃会话 ID */
  activeId: string | null
  /** 设置当前活跃会话 ID */
  setActiveId: (id: string | null) => void
  /** 已保存会话列表 */
  savedSessions: SavedSession[]
  /** 分组占位符列表 */
  groupPlaceholders: string[]
  /** 已保存分组列表 */
  savedGroups: string[]
  /** 当前活跃会话对象 */
  activeSession: ActiveSession | null
  /** 是否显示对话框 */
  showDialog: boolean
  /** 对话框类型 */
  dialogType: SessionType
  /** 对话框初始数据 */
  dialogInitial: SessionConfig | null
  /** 凭据对话框状态 */
  credDialogState: CredentialDialogState | null
  /** 设置凭据对话框状态 */
  setCredDialogState: (state: CredentialDialogState | null) => void
  /** 打开对话框 */
  openDialog: (type?: SessionType, initial?: SessionConfig | null) => void
  /** 设置是否显示对话框 */
  setShowDialog: (show: boolean) => void
  /** 启动会话 */
  launchSession: (config: SessionConfig | SavedSession) => string
  /** 删除会话 */
  removeSession: (id: string) => void
  /** 更新会话属性 */
  updateSession: (id: string, updates: Partial<ActiveSession>) => void
  /** 更新已保存会话列表 */
  updateSaved: (next: SavedSession[], options?: { placeholderForVacatedGroup?: string }) => void
  /** 更新分组占位符列表 */
  updatePlaceholders: (next: string[]) => void
  /** 仅保存会话 */
  handleSaveOnly: (c: SessionConfig) => Promise<void>
  /** 保存并连接 */
  handleSaveAndConn: (c: SessionConfig) => Promise<void>
  /** 直接连接 */
  handleConnect: (c: SessionConfig) => void
  /** 连接已保存会话 */
  handleConnSaved: (s: SavedSession) => void
  /** 删除已保存会话 */
  handleDelSaved: (id: string) => void
  /** 复制已保存会话 */
  handleDuplicateSaved: (savedId: string) => Promise<void>
  /** 处理标签页重新排序 */
  handleTabReorder: (fromId: string, toId: string) => void
  /** 凭证对话框「保存并连接」 */
  handleCredentialSaveAndConnect: (config: SessionConfig) => Promise<void>
  /** 注册终端导出函数 */
  registerTerminalExporter: (sessionId: string, getter: TerminalTextGetter | null) => void
  /** 注册终端清屏函数 */
  registerTerminalClearScreen: (sessionId: string, fn: TerminalClearFn | null) => void
  /** 注册打开终端搜索栏函数 */
  registerTerminalOpenSearch: (sessionId: string, fn: TerminalOpenSearchFn | null) => void
  /** 清屏 */
  handleClearTabScreen: (sessionId: string) => void
  /** 打开终端内容搜索（仅当前 active 标签可用） */
  handleSearchTerminal: (sessionId: string) => void
  /** 打开当前 active 标签页终端内容搜索 */
  handleSearchActiveTerminal: () => void
  /** 保存标签页输出 */
  handleSaveTabOutput: (sessionId: string) => Promise<void>
  /** 设置退格键模式 */
  handleSetBackspaceMode: (sessionId: string, mode: BackspaceMode) => void
}

/** Session 上下文 */
const SessionContext = createContext<SessionContextValue | null>(null)

/**
 * Session 提供者组件
 * @param settings 设置
 * @param children 子组件
 * @returns Session 提供者组件
 */
export function SessionProvider({
  settings,
  children,
}: {
  /** 设置 */
  settings: AppSettings
  /** 子组件 */
  children: ReactNode
}) {
  const { t } = useI18n()

  /** 凭据同步失败提示（后端已 i18n 的文案直接显示） */
  const alertVaultSyncError = (r: IpcResult | null | undefined) => {
    alertIpcFailure(t, r, 'credentials.encryptionUnavailable')
  }

  const [sessions, setSessions] = useState<ActiveSession[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [savedSessions, setSavedSessions] = useState<SavedSession[]>(() => loadSavedSessions())
  const [groupPlaceholders, setGroupPlaceholders] = useState<string[]>(() => loadGroupPlaceholders())
  const [showDialog, setShowDialog] = useState(false)
  const [dialogType, setDialogType] = useState<SessionType>('ssh')
  const [dialogInitial, setDialogInitial] = useState<SessionConfig | null>(null)
  const [credDialogState, setCredDialogState] = useState<CredentialDialogState | null>(null)
  const terminalExportersRef = useRef<Record<string, TerminalTextGetter>>({})
  const terminalClearScreenRef = useRef<Record<string, TerminalClearFn>>({})
  const terminalOpenSearchRef = useRef<Record<string, TerminalOpenSearchFn>>({})

  /** 从已保存会话和分组占位符生成分组列表 */
  const savedGroups = getGroups(savedSessions, groupPlaceholders)
  /** 当前活跃会话对象，如果 activeId 不存在于 sessions 中则为 null */
  const activeSession = sessions.find(s => s.id === activeId) || null

  /**
   * 打开连接对话框，设置类型和初始数据（这里使用 useCallback，主要是为了“把这函数做成稳定的、可重用的函数引用”，
   * 让它在组件重渲染时不会不断变动。这种模式在 Hook 里很常见，尤其当这些函数会被传到其他组件或作为依赖使用时）
   * @param type 连接类型，可选值为 'ssh'、'telnet' 或 'serial'
   * @param initial 初始数据，编辑已保存会话时传入
   */
  const openDialog = useCallback((type: SessionType = 'ssh', initial: SessionConfig | null = null) => {
    setDialogType(type)
    setDialogInitial(initial)
    setShowDialog(true)
  }, [])

  /**
   * 启动新会话：生成 ID，添加到会话列表，设置为活跃状态，返回 ID
   * @param config 会话配置对象
   * @returns 生成的会话 ID
   */
  const launchSession = useCallback((config: SessionConfig | SavedSession): string => {
    const id = `sess-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`  // 生成唯一会话ID(格式为 sess-时间戳-4位随机字符串)
    // prev => ... 是函数形式的更新器，prev 代表更新前的旧 sessions 数组，使用函数形式可以确保你基于最新的状态更新，避免并发渲染时出现旧值问题
    // [...prev, {...}] 是使用展开运算符创建一个新的数组，包含旧数组的所有元素以及一个新的会话对象，这样做是为了保持状态的不可变性，确保 React 能正确检测到状态变化并重新渲染组件
    // { id, ...config, status: 'connecting' } 创建一个新的会话对象，包含生成的 ID、传入的配置（type、host、username 等）以及初始状态 'connecting'，然后添加到会话列表中
    setSessions((prev) => [...prev, { ...config, id, status: 'connecting' } as ActiveSession])
    setActiveId(id)
    return id
  }, [])

  /**
   * 删除会话：从会话列表中移除，更新活跃会话 ID（如果被删除的会话是当前活跃的，则切换到新的最后一个会话，否则保持不变），清除对应的 SFTP 状态
   * @param id 要删除的会话 ID
   */
  const removeSession = useCallback((id: string) => {
    setSessions(prev => {
      const next = prev.filter(s => s.id !== id)  // 过滤掉要删除的会话，生成新的会话列表
      setActiveId(cur => cur !== id ? cur : next[next.length - 1]?.id || null)  // 更新当前活跃会话 ID，如果被删除的会话是当前活跃的，则切换到新的最后一个会话，否则保持不变
      return next
    })
    delete terminalExportersRef.current[id]
    delete terminalClearScreenRef.current[id]
    delete terminalOpenSearchRef.current[id]
  }, [])

  /**
   * 注册/卸载某个会话的终端导出函数
   * @param sessionId 会话 ID
   * @param getter 导出函数，传 null 表示卸载
   */
  const registerTerminalExporter = useCallback((sessionId: string, getter: TerminalTextGetter | null) => {
    if (!getter) {
      delete terminalExportersRef.current[sessionId]
      return
    }
    terminalExportersRef.current[sessionId] = getter
  }, [])

  /**
   * 注册/卸载某个会话标签页的清屏函数（调用 xterm Terminal.clear）
   * @param sessionId 会话 ID
   * @param fn 清屏函数，传 null 表示卸载
   */
  const registerTerminalClearScreen = useCallback((sessionId: string, fn: TerminalClearFn | null) => {
    if (!fn) {
      delete terminalClearScreenRef.current[sessionId]
      return
    }
    terminalClearScreenRef.current[sessionId] = fn
  }, [])

  /**
   * 注册/卸载某个会话标签页的打开搜索栏函数
   * @param sessionId 会话 ID
   * @param fn 打开搜索栏函数，传 null 表示卸载
   */
  const registerTerminalOpenSearch = useCallback((sessionId: string, fn: TerminalOpenSearchFn | null) => {
    if (!fn) {
      delete terminalOpenSearchRef.current[sessionId]
      return
    }
    terminalOpenSearchRef.current[sessionId] = fn
  }, [])

  /**
   * 右键标签「清屏」：清当前标签对应 xterm 视口（含滚动缓冲由 xterm 行为决定）
   * @param sessionId 会话 ID
   */
  const handleClearTabScreen = useCallback((sessionId: string) => {
    terminalClearScreenRef.current[sessionId]?.()
  }, [])

  /**
   * 打开指定标签页终端内容搜索（仅当前 active 标签可用）
   * @param sessionId 会话 ID
   */
  const handleSearchTerminal = useCallback((sessionId: string) => {
    if (sessionId !== activeId) return
    terminalOpenSearchRef.current[sessionId]?.()
  }, [activeId])

  /** 打开当前 active 标签页终端内容搜索（全局快捷键） */
  const handleSearchActiveTerminal = useCallback(() => {
    if (!activeId) return
    terminalOpenSearchRef.current[activeId]?.()
  }, [activeId])

  /**
   * 保存某个标签页的终端输出到文本文件
   * @param sessionId 会话 ID
   */
  const handleSaveTabOutput = useCallback(async (sessionId: string) => {
    const getter = terminalExportersRef.current[sessionId]
    if (!getter) {
      alert(t('app.saveOutputNotReady'))
      return
    }
    const text = getter()
    if (!text?.length) {
      alert(t('app.saveOutputEmpty'))
      return
    }
    const s = sessions.find(v => v.id === sessionId)
    const label = s?.label || `${s?.type?.toUpperCase?.() || 'SESSION'}_${(s && sessionEndpoint(s)) || s?.id || sessionId}`
    const filename = `${fileTimestamp()}_${safeFileToken(label)}.txt`
    try {
      const res = await window.zterm?.save?.saveFile('terminalOutput', filename, text)
      if (res?.content?.canceled) return
      if (alertIpcFailure(t, res, 'app.saveOutputFail')) return
      alert(t('app.saveOutputOk'))
    } catch (err: unknown) {
      alert(t('app.saveOutputFail', {
        msg: err instanceof Error ? err.message : String(err),
      }))
    }
  }, [sessions, t])

  /**
   * 右键标签切换退格键模式：实时更新活跃会话；若来自已保存会话则同步写入 localStorage
   * @param sessionId 会话 ID
   * @param mode 退格键模式
   */
  const handleSetBackspaceMode = useCallback((sessionId: string, mode: BackspaceMode) => {
    const normalized = normalizeBackspaceMode(mode) ?? 'auto'
    let savedId: string | undefined

    setSessions(prev => {
      const target = prev.find(s => s.id === sessionId)
      if (!target) return prev
      savedId = target.savedId
      return prev.map(s => s.id === sessionId ? { ...s, backspaceMode: normalized } : s)
    })

    if (savedId) {
      setSavedSessions(prev => {
        const next = prev.map(s => s.savedId === savedId ? { ...s, backspaceMode: normalized } : s)
        saveSessions(next)
        return next
      })
    }
  }, [])

  /**
   * 更新会话属性
   * @param id 会话 ID
   * @param updates 要更新的属性
   */
  const updateSession = useCallback((id: string, updates: Partial<ActiveSession>) => {
    setSessions(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s))
  }, [])

  /**
   * 更新已保存会话列表和分组占位符列表变量，并保存到本地localStorage
   * @param next 新的会话列表
   * @param [options] 编辑会话导致原分组被腾空时，传入原分组路径以写入占位符
   */
  const updateSaved = useCallback((next: SavedSession[], options?: { placeholderForVacatedGroup?: string }) => {
    setSavedSessions(next)
    saveSessions(next)
    setGroupPlaceholders(prev => {
      let p = prunePlaceholdersForOccupiedGroups(next, prev)
      if (options?.placeholderForVacatedGroup) {
        p = addGroupPlaceholder(p, options.placeholderForVacatedGroup)
      }
      const changed =
        p.length !== prev.length ||
        p.some((g, i) => g !== prev[i])
      if (changed) saveGroupPlaceholders(p)
      return p
    })
  }, [])

  /**
   * 更新分组占位符列表变量，并保存到localStorage
   * @param next 新的占位符列表
   */
  const updatePlaceholders = useCallback((next: string[]) => {
    setGroupPlaceholders(next)
    saveGroupPlaceholders(next)
  }, [])

  /**
   * 仅保存会话（编辑/新建）：若 initialData 有 savedId，则编辑该会话；否则新建。同时检查是否需要添加占位分组
   * @param c 会话配置对象
   */
  const handleSaveOnly = useCallback(async (c: SessionConfig) => {
    const config = dialogInitial?.savedId ? { ...c, savedId: dialogInitial.savedId } : c
    const before = dialogInitial?.savedId
      ? savedSessions.find(s => s.savedId === dialogInitial.savedId)
      : null
    const { next, vacated } = prepareSavedSessionUpdate(savedSessions, config, before)
    updateSaved(next, vacated ? { placeholderForVacatedGroup: vacated } : undefined)
    const sid = resolveAffectedSavedId(savedSessions, next, config)
    if (sid) {
      const r = await syncSessionSecretsToVault(sid, config, settings)
      alertVaultSyncError(r)
    }
    setShowDialog(false)
  }, [savedSessions, updateSaved, dialogInitial, settings, t])

  /**
   * 保存并连接：先保存会话配置（编辑/新建），然后启动会话。同时检查是否需要添加占位分组
   * @param c 会话配置对象
   */
  const handleSaveAndConn = useCallback(async (c: SessionConfig) => {
    const config = dialogInitial?.savedId ? { ...c, savedId: dialogInitial.savedId } : c
    const before = dialogInitial?.savedId
      ? savedSessions.find(s => s.savedId === dialogInitial.savedId)
      : null
    const { next, vacated } = prepareSavedSessionUpdate(savedSessions, config, before)
    updateSaved(next, vacated ? { placeholderForVacatedGroup: vacated } : undefined)
    const sid = resolveAffectedSavedId(savedSessions, next, config)
    if (sid) {
      const r = await syncSessionSecretsToVault(sid, config, settings)
      alertVaultSyncError(r)
    }
    launchSession(c)
    setShowDialog(false)
  }, [savedSessions, updateSaved, launchSession, dialogInitial, settings, t])

  /**
   * 直接连接：不保存会话配置，直接启动会话
   * @param c 会话配置对象
   */
  const handleConnect = useCallback((c: SessionConfig) => {
    launchSession(c)
    setShowDialog(false)
  }, [launchSession])

  /**
   * 凭证对话框「保存并连接」：更新已保存会话；仅当 saveSecretsToVault 为 true 时把密码/私钥等写入加密库（关闭时保留库内已有凭据）
   * @param config 含 savedId 的完整连接配置
   */
  const handleCredentialSaveAndConnect = useCallback(async (config: SessionConfig) => {
    if (!config?.savedId) {
      launchSession(config)
      return
    }
    const before = savedSessions.find((s) => s.savedId === config.savedId)
    const { next, vacated } = prepareSavedSessionUpdate(savedSessions, config, before)
    updateSaved(next, vacated ? { placeholderForVacatedGroup: vacated } : undefined)
    // 与「保存会话」一致：仅 saveSecretsToVault 为 true 时同步 vault；关闭时不写入也不清除库内已有凭据
    const r = await syncSessionSecretsToVault(config.savedId, config, settings)
    alertVaultSyncError(r)
    launchSession(config)
  }, [savedSessions, updateSaved, settings, launchSession, t])

  /**
   * 连接已保存会话：SSH 缺凭据时弹出凭证对话框；Telnet/Serial 直接启动
   * @param s 会话配置对象
   */
  const handleConnSaved = useCallback((s: SavedSession) => {
    void (async () => {
      if (s.type === 'serial' || s.type === 'telnet') {
        launchSession(s)
        return
      }
      const merged = await mergeSessionWithVaultSecrets(s)
      if (merged.type === 'ssh') {
        if (!merged.username?.trim()) {
          setCredDialogState(openCredentialDialog(merged))
          return
        }
        if (merged.authType === 'privateKey') {
          if (!merged.privateKey?.trim()) {
            setCredDialogState(openCredentialDialog(merged))
            return
          }
        } else if (!merged.password?.trim()) {
          setCredDialogState(openCredentialDialog(merged))
          return
        }
        launchSession(merged)
      }
    })()
  }, [launchSession])

  /**
   * 删除已保存会话：从 savedSessions 变量中移除会话、考虑是否需要添加占位分组，然后保存到本地 localStorage
   * @param id 会话 ID
   */
  const handleDelSaved = useCallback((id: string) => {
    const deleted = savedSessions.find(s => s.savedId === id)
    void removeVaultEntry(id)
    const next = removeSavedSession(savedSessions, id)
    const vacated = deleted?.group
      ? vacatedNamedGroupIfEmpty(deleted.group, next)
      : undefined
    updateSaved(next, vacated ? { placeholderForVacatedGroup: vacated } : undefined)
  }, [savedSessions, updateSaved])

  /**
   * 处理标签页重新排序：接收拖动的会话 ID 和目标位置的会话 ID，更新 sessions 顺序
   * @param fromId 被拖动的会话 ID
   * @param toId 目标位置的会话 ID
   */
  const handleDuplicateSaved = useCallback(async (savedId: string) => {
    const next = duplicateSavedSession(savedSessions, savedId)
    const added = next.find((s) => !savedSessions.some((o) => o.savedId === s.savedId))
    if (added?.savedId) await duplicateVaultEntry(savedId, added.savedId)
    updateSaved(next)
  }, [savedSessions, updateSaved])

  /**
   * 处理标签页重新排序：接收拖动的会话 ID 和目标位置的会话 ID，更新 sessions 顺序
   * @param fromId 被拖动的会话 ID
   * @param toId 目标位置的会话 ID
   */
  const handleTabReorder = useCallback((fromId: string, toId: string) => {
    setSessions(prev => {
      const from = prev.findIndex(s => s.id === fromId)  // 找到被拖动的会话在当前列表中的索引，如果找不到则返回 -1
      const to = prev.findIndex(s => s.id === toId)  // 找到目标位置的会话在当前列表中的索引，如果找不到则返回 -1
      if (from < 0 || to < 0) return prev
      const next = [...prev]
      const [item] = next.splice(from, 1)  // 从原位置移除被拖动的会话，splice 返回一个包含被移除元素的数组，这里使用解构赋值取出该元素
      next.splice(to, 0, item)  // 在目标位置插入被拖动的会话，splice 的第二个参数为 0 表示不删除任何元素，而是直接插入
      return next
    })
  }, [])

  const value: SessionContextValue = {
    sessions,
    activeId,
    setActiveId,
    savedSessions,
    groupPlaceholders,
    savedGroups,
    activeSession,
    showDialog,
    dialogType,
    dialogInitial,
    credDialogState,
    setCredDialogState,
    openDialog,
    setShowDialog,
    launchSession,
    removeSession,
    updateSession,
    updateSaved,
    updatePlaceholders,
    handleSaveOnly,
    handleSaveAndConn,
    handleConnect,
    handleConnSaved,
    handleDelSaved,
    handleDuplicateSaved,
    handleTabReorder,
    handleCredentialSaveAndConnect,
    registerTerminalExporter,
    registerTerminalClearScreen,
    registerTerminalOpenSearch,
    handleClearTabScreen,
    handleSearchTerminal,
    handleSearchActiveTerminal,
    handleSaveTabOutput,
    handleSetBackspaceMode,
  }

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

/**
 * 使用 Session 上下文
 * @returns Session 上下文值
 */
export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession must be used within SessionProvider')
  return ctx
}
