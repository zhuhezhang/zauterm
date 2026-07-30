import { useState, useEffect, useCallback, useRef, useLayoutEffect, memo, type KeyboardEvent, type RefObject } from 'react'
import { useI18n } from '../context/I18nContext'
import { useDismissOnEscape } from '@/hooks/useDismissOnEscape'
import { ipcPortsFromResponse } from '@/lib/ipc/ipcResponse'
import { fetchSessionSecrets } from '../store/credentialsBridge'
import { DEFAULT_TERMINAL_ENCODING } from '../../shared/terminalEncoding'
import { TERMINAL_ENCODING_OPTIONS } from '../lib/terminalEncodingService'
import FormRow from './connect/FormRow'
import { PrivateKeyField } from './connect/PrivateKeyField'
import SshForm from './connect/SshForm'
import TelnetForm from './connect/TelnetForm'
import SerialForm from './connect/SerialForm'
import { isSerialPathInEnumeratedList } from '../../shared/isSerialPathInEnumeratedList'
import type { ConnectDialogProps } from '../types/components'
import type { ConnectCredDialogState } from '../types/components'
import type { SessionConfig, SessionFormValues, SessionType } from '../types/session'
import {
  SESSION_GROUP_LABEL_ERROR_KEYS,
  SSH_SESSION_DEFAULT, TELNET_SESSION_DEFAULT, SERIAL_SESSION_DEFAULT,
} from '../lib/session/defaults'
import {
  mergeSessionFormDefaults, normalizeBackspaceMode, clampPortFieldString, parseSessionPort,
  buildSessionLabel, validateSessionGroupLabel,
} from '../lib/session/utils'
import '../styles/dialog.css'

/** 连接对话框组件：提供 SSH、Telnet、Serial 三种连接方式的配置界面，支持保存会话和直接连接 */
function ConnectDialog({
  type,
  initialData,
  savedGroups,
  onConnect,
  onSaveAndConnect,
  onSaveOnly,
  onClose,
}: ConnectDialogProps) {
  const { t } = useI18n()
  const [tab, setTab] = useState<SessionType>(type || 'ssh')
  const [form, setForm] = useState<SessionFormValues>(() =>
    mergeSessionFormDefaults(type || 'ssh', initialData ?? undefined),
  )
  const [ports, setPorts] = useState<{ path?: string }[]>([])
  const [error, setError] = useState('')
  const [credDialog, setCredDialog] = useState<ConnectCredDialogState | null>(null)
  useDismissOnEscape(!!credDialog, () => setCredDialog(null))
  useDismissOnEscape(!credDialog, onClose)

  const credUserInputRef = useRef<HTMLInputElement | null>(null)
  const credPkeyInputRef = useRef<HTMLTextAreaElement | null>(null)
  const credPassInputRef = useRef<HTMLInputElement | null>(null)
  const credFocusAppliedRef = useRef(false)
  const portByTabRef = useRef<{ ssh: string; telnet: string }>({ ssh: '', telnet: '' })
  if (!portByTabRef.current.ssh) {
    const initialTab = type || 'ssh'
    const initialForm = mergeSessionFormDefaults(initialTab, initialData ?? undefined)
    const toRefPort = (tabKey: SessionType, raw: string | number | undefined) => {
      const fallback = tabKey === 'ssh' ? SSH_SESSION_DEFAULT.port : TELNET_SESSION_DEFAULT.port
      const s = String(raw ?? '').trim()
      return s === '' ? String(fallback) : clampPortFieldString(s) || String(fallback)
    }
    portByTabRef.current = {
      ssh: initialTab === 'ssh' ? toRefPort('ssh', initialForm.port) : String(SSH_SESSION_DEFAULT.port),
      telnet: initialTab === 'telnet' ? toRefPort('telnet', initialForm.port) : String(TELNET_SESSION_DEFAULT.port),
    }
  }

  /**
   * 切换协议类型时更新表单数据。保留已有参数，补齐当前协议缺省字段，重置错误信息。
   * SSH 与 Telnet 互切时端口不跟随对方，恢复该协议上次使用的端口（首次为 22 / 23）。
   * @param next 新的协议类型
   */
  const switchTab = (next: SessionType) => {
    if (next === tab) return
    const from = tab
    setForm((prev) => {
      if (from === 'ssh') {
        const s = String(prev.port ?? '').trim()
        portByTabRef.current.ssh = s === '' ? String(SSH_SESSION_DEFAULT.port) : clampPortFieldString(s) || String(SSH_SESSION_DEFAULT.port)
      }
      if (from === 'telnet') {
        const s = String(prev.port ?? '').trim()
        portByTabRef.current.telnet = s === '' ? String(TELNET_SESSION_DEFAULT.port) : clampPortFieldString(s) || String(TELNET_SESSION_DEFAULT.port)
      }
      const merged = mergeSessionFormDefaults(next, prev)
      if (next === 'ssh' || next === 'telnet') {
        const p = next === 'ssh' ? portByTabRef.current.ssh : portByTabRef.current.telnet
        return { ...merged, port: p }
      }
      return merged
    })
    setTab(next)
    setError('')
  }

  /** 刷新串口列表，用于串口连接时选择串口设备 */
  const refreshSerialPorts = useCallback(() => {  // useCallback: 记忆化回调函数，避免重复创建回调函数，提高性能。当依赖项变化时，回调函数会被重新创建并记忆化
    window.zterm?.serial.listPorts().then((res) => {
      setPorts(ipcPortsFromResponse(res) as { path?: string }[])
    })
  }, [])

  useEffect(() => {  // 监听 tab 变化，切换到 Serial 时枚举串口
    setError('')
    if (tab === 'serial') refreshSerialPorts()
  }, [tab, refreshSerialPorts])

  useEffect(() => {  // 编辑已保存 SSH 会话时从 vault 拉取敏感字段合并到表单
    let cancelled = false
    const sid = initialData?.savedId
    if (!sid) return
    void (async () => {
      const sessionType = initialData.type || type || 'ssh'
      const sec = sessionType === 'telnet' ? {} : await fetchSessionSecrets(sid)
      if (cancelled) return
      const merged: SessionFormValues = {
        ...mergeSessionFormDefaults(sessionType, initialData ?? undefined),
        ...(sec.password ? { password: sec.password } : {}),
        ...(sec.privateKey ? { privateKey: sec.privateKey } : {}),
        ...(sec.passphrase ? { passphrase: sec.passphrase } : {}),
      }
      if (sessionType === 'ssh' || sessionType === 'telnet') {
        const s = String(merged.port ?? '').trim()
        const fallback = sessionType === 'ssh' ? SSH_SESSION_DEFAULT.port : TELNET_SESSION_DEFAULT.port
        portByTabRef.current[sessionType] = s === '' ? String(fallback) : clampPortFieldString(s) || String(fallback)
      }
      setTab(sessionType as SessionType)
      setForm(merged)
    })()
    return () => { cancelled = true }
  }, [initialData?.savedId, initialData?.type, type])

  /** 
   * 更新表单数据的通用函数。接收一个键和值，使用 setForm 更新对应的表单字段，同时保留其他字段不变
   * @param key 设置项的键
   * @param value 设置项的值
   */
  const set = <K extends keyof SessionFormValues>(k: K, v: SessionFormValues[K]) =>
    setForm((prev) => ({ ...prev, [k]: v }))

  /** 表单验证。保存会话时可跳过串口是否在枚举列表中的校验（设备未插入时也可保存配置） */
  const validate = (forSave = false) => {
    if (tab === 'ssh' && !form.host?.trim()) return t('connect.errHost')
    if (tab === 'telnet' && !form.host?.trim()) return t('connect.errHost')
    if (tab === 'serial') {
      if (!form.path?.trim()) return t('connect.errSerial')
      if (!forSave && !isSerialPathInEnumeratedList(form.path, ports)) {
        return t('connect.errSerialList')
      }
    }
    const glErr = validateSessionGroupLabel(form.group, form.label)
    if (glErr) return t(SESSION_GROUP_LABEL_ERROR_KEYS[glErr]) // 根据错误码获取错误信息
    return ''
  }

  /**
   * 构建配置对象，准备连接或保存。根据当前协议类型和表单数据生成一个完整的配置对象，进行必要的类型转换和默认值处理，同时生成标签名称（如果未指定标签则根据协议和主机信息生成）。该配置对象将作为连接或保存的参数传递给回调函数
   * @returns 配置对象
   */
  const buildConfig = (): SessionConfig => ({
    ...form,
    type: tab,
    backspaceMode: normalizeBackspaceMode(form.backspaceMode) ?? 'auto',
    port: parseSessionPort(form.port),
    baudRate: parseInt(String(form.baudRate ?? ''), 10) || SERIAL_SESSION_DEFAULT.baudRate,
    dataBits: parseInt(String(form.dataBits ?? ''), 10) || SERIAL_SESSION_DEFAULT.dataBits,
    stopBits: parseInt(String(form.stopBits ?? ''), 10) || SERIAL_SESSION_DEFAULT.stopBits,
    label: form.label?.trim() || buildSessionLabel(tab, form),
  })

  useLayoutEffect(() => {  // 凭证弹层内 HTML autoFocus 易被关闭按钮等抢占；打开时在 layout 阶段 + 下一帧主动 focus 一次（useLayoutEffect 在 DOM 渲染后执行，不会阻塞主线程，不会影响用户体验）
    if (!credDialog) {
      credFocusAppliedRef.current = false
      return
    }
    if (credFocusAppliedRef.current) return
    credFocusAppliedRef.current = true

    const cfg = buildConfig()
    const keyAuth = cfg.type === 'ssh' && cfg.authType === 'privateKey'
    const u = credDialog.username?.trim()
    const hasPkey = credDialog.privateKey?.trim()
    const hasPwd = credDialog.password?.trim()

    let el
    if (!u) el = credUserInputRef.current  // 如果用户名为空，则聚焦到用户名输入框
    else if (keyAuth && !hasPkey) el = credPkeyInputRef.current
    else if (!keyAuth && !hasPwd) el = credPassInputRef.current
    else el = credUserInputRef.current

    const run = () => { // 在凭证弹层内每次输入都重复 focus，只在本次打开时聚焦一次
      el?.focus()
      if (el === credUserInputRef.current && !u) el?.select?.()
    }
    run()
    const id = requestAnimationFrame(run)  // requestAnimationFrame 让回调函数在下一帧执行（是异步的，不会阻塞主线程，不会影响用户体验）
    return () => cancelAnimationFrame(id)
  }, [credDialog])

  /**
   * 检查是否需要输入凭证（用户名或密码为空）
   * @param config 配置对象
   * @returns 是否需要输入凭证
   */
  const needsCredentials = (config: SessionConfig) => {
    if (config.type === 'telnet') return false
    if (config.type === 'ssh') {
      if (!config.username?.trim()) return true
      if (config.authType === 'privateKey') return !config.privateKey?.trim()
      return !config.password?.trim()
    }
    return false
  }

  const act = (fn: (config: SessionConfig) => void, requireCreds = true, forSave = false) => {
    const e = validate(forSave)
    if (e) return setError(e)
    const config = buildConfig()

    if (requireCreds && needsCredentials(config)) {  // 只有在 requireCreds=true 时才检查凭证（保存会话时不检查）
      setCredDialog({
        username: config.username || '',
        password: config.password || '',
        privateKey: config.privateKey || '',
        passphrase: config.passphrase || '',
        callback: fn,
      })
      return  // 当在ssh或telnet连接界面不输入用户名连接时，由于上面setCredDialog会触发重新渲染，此时credDialog不再是null，就会渲染输入凭证组件。
    }
    fn(config)
  }

  const saveAndConnect = () => act(onSaveAndConnect, true, true)
  const handleFormEnter = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') saveAndConnect()
  }

  if (credDialog) {  // 如果 credDialog 不为 null，则渲染凭证输入对话框，传入初始用户名、密码和连接回调函数
    const { username, password, privateKey, passphrase, callback } = credDialog
    const cfg = buildConfig()
    const keyAuth = cfg.type === 'ssh' && cfg.authType === 'privateKey'
    /**
     * 应用凭证函数。根据当前协议类型和表单数据生成一个完整的配置对象，进行必要的类型转换和默认值处理，
     * 同时生成标签名称（如果未指定标签则根据协议和主机信息生成）。该配置对象将作为连接或保存的参数传递给回调函数，然后关闭凭证输入对话框
     * @returns 配置对象
     */
    const applyCred = () => {
      const config = keyAuth
        ? { ...buildConfig(), username, privateKey, passphrase }
        : { ...buildConfig(), username, password }
      setCredDialog(null)
      callback(config)
    }

    /**
     * 处理凭证输入框回车事件。如果输入框为空，则聚焦到输入框，如果输入框不为空，则提交凭证
     * @param field 输入框类型
     */
    const handleCredEnter = (field: 'user' | 'pkey' | 'pass' | 'passphrase') => {
    const required: { id: 'user' | 'pkey' | 'pass'; ref: RefObject<HTMLInputElement | HTMLTextAreaElement | null>; value: string }[] = keyAuth
        ? [
            { id: 'user', ref: credUserInputRef, value: username },
            { id: 'pkey', ref: credPkeyInputRef, value: privateKey },
          ]
        : [
            { id: 'user', ref: credUserInputRef, value: username },
            { id: 'pass', ref: credPassInputRef, value: password },
          ]

      if (field !== 'passphrase') {
        const current = required.find(item => item.id === field)
        if (current && !current.value.trim()) {
          current.ref.current?.focus()
          return
        }
      }

      const firstEmpty = required.find(item => !item.value.trim())
      if (firstEmpty) {
        firstEmpty.ref.current?.focus()
        return
      }

      applyCred()
    }

    return (
      <div className="dialog-overlay" onClick={e => e.target === e.currentTarget && setCredDialog(null)}>
        <div className="dialog">
          <div className="dialog-header">
            <div className="dialog-tabs">{t('credential.title')}</div>
            <button className="dialog-close" onClick={() => setCredDialog(null)}>×</button>
          </div>
          <div className="dialog-body">
            <FormRow label={t('connect.username')}>
              <input
                ref={credUserInputRef}
                value={username}
                onChange={e => setCredDialog(prev => prev ? { ...prev, username: e.target.value } : null)}
                onKeyDown={e => e.key === 'Enter' && handleCredEnter('user')}
              />
            </FormRow>
            {keyAuth ? (
              <>
                <FormRow label={t('connect.privateKey')} topAlign>
                  <PrivateKeyField
                    ref={credPkeyInputRef}
                    placeholder={t('connect.privateKeyPh')}
                    value={privateKey}
                    onChange={value => setCredDialog(prev => prev ? { ...prev, privateKey: value } : null)}
                    onSubmit={() => handleCredEnter('pkey')}
                  />
                </FormRow>
                <FormRow label={t('connect.passphrase')}>
                  <input
                    type="password"
                    placeholder={t('connect.passphrasePh')}
                    value={passphrase}
                    onChange={e => setCredDialog(prev => prev ? { ...prev, passphrase: e.target.value } : null)}
                    onKeyDown={e => e.key === 'Enter' && handleCredEnter('passphrase')}
                  />
                </FormRow>
              </>
            ) : (
              <FormRow label={t('connect.password')}>
                <input
                  ref={credPassInputRef}
                  type="password"
                  value={password}
                  onChange={e => setCredDialog(prev => prev ? { ...prev, password: e.target.value } : null)}
                  onKeyDown={e => e.key === 'Enter' && handleCredEnter('pass')}
                />
              </FormRow>
            )}
          </div>
          <div className="dialog-footer">
            <button className="btn-cancel" onClick={() => setCredDialog(null)}>{t('credential.cancel')}</button>
            <button className="btn-connect" onClick={applyCred}>{t('credential.connect')}</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="dialog-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="dialog">
        <div className="dialog-header">
          <div className="dialog-tabs">
            {(['ssh', 'telnet', 'serial'] as const).map((proto) => (
              <button key={proto} type="button" className={`dialog-tab ${tab === proto ? 'active' : ''}`} onClick={() => switchTab(proto)}>
                {proto === 'ssh' ? 'SSH' : proto === 'telnet' ? 'Telnet' : 'Serial'}
              </button>
            ))}
          </div>
          <button className="dialog-close" onClick={onClose}>×</button>
        </div>

        <div className="dialog-body">
          <FormRow label={t('connect.label')}>
            <input placeholder={t('connect.labelPh')} value={form.label ?? ''} onChange={e => set('label', e.target.value)} onKeyDown={handleFormEnter} />
          </FormRow>
          <FormRow label={t('connect.group')}>
            <input placeholder={t('connect.groupPh')} value={form.group ?? ''} onChange={e => set('group', e.target.value)} list="group-list" onKeyDown={handleFormEnter} />
            <datalist id="group-list">
              {(savedGroups || []).map(g => <option key={g} value={g} />)}
            </datalist>
          </FormRow>
          <div className="dialog-divider" />
          <SshForm form={form} set={set} visible={tab === 'ssh'} onEnter={saveAndConnect} />
          <TelnetForm form={form} set={set} visible={tab === 'telnet'} onEnter={saveAndConnect} />
          <SerialForm form={form} set={set} ports={ports} visible={tab === 'serial'} onRefreshPorts={refreshSerialPorts} onEnter={saveAndConnect} />
          <FormRow label={t('connect.encoding')}>
            <select value={form.encoding || DEFAULT_TERMINAL_ENCODING} onChange={e => set('encoding', e.target.value)}>
              {TERMINAL_ENCODING_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </FormRow>
          <FormRow label={t('connect.backspaceMode')} title={t('connect.backspaceModeHint')}>
            <select value={form.backspaceMode || 'auto'} onChange={e => set('backspaceMode', e.target.value)}>
              <option value="auto">{t('settings.options.backspaceAuto')}</option>
              <option value="del">{t('settings.options.backspaceDel')}</option>
              <option value="bs">{t('settings.options.backspaceBs')}</option>
            </select>
          </FormRow>
          {error && <div className="dialog-error">{error}</div>}
        </div>

        <div className="dialog-footer">
          <button className="btn-cancel" onClick={onClose}>{t('connect.cancel')}</button>
          <button className="btn-save" onClick={() => act(onSaveOnly, false, true)}>{t('connect.save')}</button>
          <button className="btn-connect" onClick={() => act(onConnect, true)}>{t('connect.connectDirect')}</button>
          <button className="btn-save-connect" onClick={saveAndConnect}>{t('connect.saveAndConnect')}</button>
        </div>
      </div>
    </div>
  )
}

export default memo(ConnectDialog)
