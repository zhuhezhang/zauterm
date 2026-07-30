import { useState, useEffect, Fragment, type Dispatch, type SetStateAction } from 'react'
import { useDismissOnEscape } from '@/hooks/useDismissOnEscape'
import { I18nProvider, useI18n } from '@/context/I18nContext'
import { alertIpcFailure } from '@/lib/ipc/formatIpcError'
import { getZterm } from '@/lib/ipc/getZterm'
import { isIpcSuccess } from '@/lib/ipc/ipcResponse'
import { exportSessions, saveSessions } from '@/store/sessionStore'
import { reportSettingsImportResult } from '@/lib/settings/importWarnings'
import { reportImportError } from '@/lib/import/handleImportErrors'
import { createHighlightRuleId } from '@/lib/settings/highlightRules'
import { buildSettingsFromForm } from '@/lib/settings/buildSettingsFromForm'
import { clearAllVaultEntries } from '@/store/credentialsBridge'
import { DEFAULT_SETTINGS, SSH_ALGORITHM_SECTION_KEYS } from '@/lib/settings/defaults'
import { DEFAULT_ALGORITHM_SELECTION, type AlgorithmCategory } from '../../shared/sshAlgorithmDefaults'
import { SETTINGS_SCHEMA, SETTINGS_TABS, SETTINGS_TAB_SECTION_IDS } from '@/lib/settings/schema'
import { saveSettings, exportSettings } from '@/store/settingsStore'
import { validateAndParseSettingsImportContent } from '@/lib/import/parseSettingsImport'
import { useSessionsImport } from '@/hooks/useSessionsImport'
import { useSettingsHoverTip } from '@/hooks/useSettingsHoverTip'
import SettingsGenericSection from './settings/SettingsGenericSection'
import type { SettingsDialogProps } from '@/types/components'
import type { AppSettings, AppTheme, HighlightRule } from '@/types/settings'
import type { TerminalFontFamilyKey } from '../../shared/terminalFonts'
import type { SettingsActionKey, SettingsGenericSectionDef, SettingsTabKey } from '@/types/settings'
import '../styles/dialog.css'
import '../styles/settings.css'

/** 设置对话框组件。用于提供应用设置的界面，包括日志路径配置和会话管理功能 */
function SettingsDialogContent({
  form,
  setForm,
  ...props
}: SettingsDialogProps & {
  form: AppSettings
  setForm: Dispatch<SetStateAction<AppSettings>>
}) {
  const { savedSessions, onUpdateSessions, onUpdatePlaceholders, onClose, onSave, onAppThemePreview, onTerminalFontFamilyPreview } = props
  useDismissOnEscape(true, onClose)
  const { t, lang: previewLanguage } = useI18n()
  /** 设置标签页列表 */
  const tabs = SETTINGS_TABS.map((tab) => ({ key: tab.key, label: t(tab.labelKey) }))
  const [activeTab, setActiveTab] = useState('general')  // 当前选中的标签页
  /** null=检测中；true/false=系统 safeStorage 是否可用于凭据加密 */
  const [vaultEncryptionAvailable, setVaultEncryptionAvailable] = useState<boolean | null>(null)
  const { settingsHoverTip, showSettingsHoverTip, hideSettingsHoverTip } = useSettingsHoverTip()  // 设置弹窗内浮动说明（原生 title 在 Electron 内不可靠，用 fixed 层统一展示）
  const { triggerImport: triggerImportSessions } = useSessionsImport(
    savedSessions,
    onUpdateSessions,
  )

  useEffect(() => {  // 检查系统是否支持加密存储
    let cancelled = false
    ;(async () => {
      try {
        const res = await window.zterm?.credentials?.isAvailable?.()
        if (cancelled) return
        setVaultEncryptionAvailable(isIpcSuccess(res) && res.content?.available === true)
      } catch {
        if (!cancelled) setVaultEncryptionAvailable(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {  // 如果系统不支持加密存储，则禁用保存凭据到加密存储选项
    if (vaultEncryptionAvailable !== false) return
    setForm((prev) => (prev.saveSecretsToVault ? { ...prev, saveSecretsToVault: false } : prev))
  }, [vaultEncryptionAvailable])

  /** 创建一个新的高亮规则对象，包含唯一的 ID、启用状态、是否使用正则表达式、匹配模式和颜色 */
  const createHighlightRule = () => ({
    id: createHighlightRuleId(),
    name: '',
    enabled: true,
    useRegex: true,
    caseSensitive: false,
    pattern: '',
    color: '#ffcc00',
  })

  /** 
   * 更新高亮规则，根据规则 ID 和要更新的属性值修改表单中的高亮规则列表
   * @param id 要更新的规则 ID
   * @param changes 要更新的属性和值，例如 { enabled: false } 表示禁用该规则
   */
  const updateHighlightRule = (id: string, changes: Partial<HighlightRule>) => {
    setForm(prev => ({
      ...prev,
      highlightRules: (prev.highlightRules || []).map(rule =>
        rule.id === id ? { ...rule, ...changes } : rule
      ),
    }))
  }

  /** 添加新的高亮规则，在表单的高亮规则列表中追加一个新的规则对象。新规则会被自动赋予一个唯一的 ID，默认启用，使用正则表达式，匹配模式为空，颜色为黄色 */
  const addHighlightRule = () => {
    setForm(prev => ({
      ...prev,
      highlightRules: [...(prev.highlightRules || []), createHighlightRule()],
    }))
  }

  /**
   * 删除高亮规则，根据规则 ID 从表单的高亮规则列表中过滤掉对应的规则对象
   * @param id 要删除的规则 ID
   */
  const removeHighlightRule = (id: string) => {
    setForm(prev => ({
      ...prev,
      highlightRules: (prev.highlightRules || []).filter(rule => rule.id !== id),
    }))
  }

  /** 将高亮规则列表恢复为应用内置默认（仅更新表单，需再点「保存」写入本地） */
  const handleResetHighlightRules = () => {
    if (!confirm(t('settings.confirmResetHighlight'))) return
    const defaults = JSON.parse(JSON.stringify(DEFAULT_SETTINGS.highlightRules))
    setForm(prev => ({ ...prev, highlightRules: defaults }))
  }

  /**
   * 更新设置
   * @param key 设置项的键
   * @param value 设置项的新值
   */
  const previewAppTheme = (theme: AppTheme) => {
    if (typeof onAppThemePreview === 'function' && ['dark', 'light', 'auto'].includes(theme)) {
      onAppThemePreview(theme)
    }
  }

  /**
   * 更新设置，同时预览应用主题
   * @param key 设置项的键
   * @param value 设置项的新值
   */
  const set = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setForm(prev => ({ ...prev, [key]: value }))
    if (key === 'appTheme') previewAppTheme(value as AppTheme)
    if (key === 'terminalFontFamily') {
      onTerminalFontFamilyPreview?.(value as TerminalFontFamilyKey)
    }
  }  // [key] 表示“用这个变量的值作为属性名”

  /** 算法选项列表 */
  const algorithmSections = SSH_ALGORITHM_SECTION_KEYS.map((key) => ({
    key: key as AlgorithmCategory,
    label: t(`settings.algo.${key}`),
  }))

  /**
   * 切换算法选项，根据算法类别和选项值更新表单中的算法偏好设置
   * @param type 算法类别，例如 'kex'、'serverHostKey'、'cipher'、'hmac'、'compress'
   * @param value 要切换的算法选项值，例如 'curve25519-sha256'、'ssh-ed25519'、'aes128-gcm'、'hmac-sha2-256'、'zlib'
   */
  const toggleAlgorithmOption = (type: AlgorithmCategory, value: string) => {
    setForm(prev => {
      const selected = prev.algorithmPreferences?.[type] || []  // 获取当前选中的算法选项列表，如果没有则返回空数组
      const exists = selected.includes(value)  // 检查要切换的算法选项是否已经选中
      const next = exists ? selected.filter((item: string) => item !== value) : [...selected, value]  // 如果已经选中，则移除该选项，否则添加该选项
      return {
        ...prev,  // 复制当前表单数据
        algorithmPreferences: { ...prev.algorithmPreferences, [type]: next },  // 更新指定算法类别的选项列表
      }
    })
  }

  /**
   * 移动算法选项，根据算法类别和选项值更新表单中的算法偏好设置
   * @param type 算法类别，例如 'kex'、'serverHostKey'、'cipher'、'hmac'、'compress'
   * @param value 要移动的算法选项值，例如 'curve25519-sha256'、'ssh-ed25519'、'aes128-gcm'、'hmac-sha2-256'、'zlib'
   * @param direction 移动方向，-1 表示向上移动，1 表示向下移动
   */
  const moveAlgorithmOption = (type: AlgorithmCategory, value: string, direction: number) => {
    setForm(prev => {
      const selected = prev.algorithmPreferences?.[type] || []  // 获取当前选中的算法选项列表，如果没有则返回空数组
      const index = selected.indexOf(value)  // 获取要移动的算法选项在列表中的索引
      if (index < 0) return prev  // 如果索引小于0，则返回当前表单数据
      const nextIndex = index + direction  // 计算移动后的索引
      if (nextIndex < 0 || nextIndex >= selected.length) return prev  // 如果移动后的索引小于0或大于等于列表长度，则返回当前表单数据
      const next = [...selected]
      ;[next[index], next[nextIndex]] = [next[nextIndex], next[index]]  // 交换两个索引位置的值
      return {
        ...prev,
        algorithmPreferences: { ...prev.algorithmPreferences, [type]: next },
      }
    })
  }

  /** 重置算法偏好设置，将表单中的算法偏好设置恢复为默认值 */
  const resetAlgorithmPreferences = () => set('algorithmPreferences', DEFAULT_ALGORITHM_SELECTION)

  /** 仅将某一算法类别恢复为内置默认顺序与勾选集合 */
  const resetAlgorithmSection = (type: AlgorithmCategory) => {
    const defaults = DEFAULT_ALGORITHM_SELECTION[type]
    if (!defaults) return
    setForm(prev => ({
      ...prev,
      algorithmPreferences: { ...prev.algorithmPreferences, [type]: [...defaults] },
    }))
  }

  /** 处理保存设置的操作，将当前表单数据保存到设置中，并调用 onSave 回调函数传递新的设置对象 */
  const handleSave = () => {
    const next = buildSettingsFromForm(form, previewLanguage)
    setForm(next)
    saveSettings(next)
    onSave(next)
  }

  /** 处理保存并关闭设置的操作，将当前表单数据保存到设置中，并调用 onSave 和 onClose 回调函数 */
  const handleSaveAndClose = () => {
    const next = buildSettingsFromForm(form, previewLanguage)
    setForm(next)
    saveSettings(next)
    onSave(next)
    onClose()
  }

  /** 处理导出会话的操作，将当前的 savedSessions 导出为 JSON 文件 */
  const handleExport = () => { void exportSessions(savedSessions, t) }

  /** 处理清除所有会话的操作，弹出两次确认对话框，确认后清除所有保存的会话和分组占位符，并更新会话列表和占位符列表 */
  const handleClearAll = () => {
    if (!confirm(t('settings.confirmClearSessions'))) return
    if (!confirm(t('settings.confirmClearSessions2'))) return
    void clearAllVaultEntries()
    onUpdateSessions([])
    saveSessions([])
    onUpdatePlaceholders?.([])  // 同时清除所有分组占位符
    alert(t('settings.clearedSessions'))
  }

  /** 处理导出设置的操作，将当前设置导出为 JSON 文件 */
  const handleExportSettings = () => { void exportSettings(form, t) }

  /** 处理导入设置的操作，从 JSON 文件导入设置并更新表单 */
  const handleImportSettings = async () => {
    try {
      const picked = await getZterm().paths.chooseOpen('importSettings')
      if (!picked?.success) {
        alertIpcFailure(t, picked, 'settings.importFail')
        return
      }
      if (picked.content.canceled) return
      const content = picked.content.content
      if (typeof content !== 'string') return

      const { settings: importedSettings, warnings } = await validateAndParseSettingsImportContent(content, form)
      setForm({
        ...importedSettings,
        highlightRules: [...importedSettings.highlightRules],
        algorithmPreferences: { ...importedSettings.algorithmPreferences },
      })
      previewAppTheme(importedSettings.appTheme)
      onTerminalFontFamilyPreview?.(importedSettings.terminalFontFamily)
      reportSettingsImportResult(t, warnings)
    } catch (err) {
      reportImportError(t, err)
    }
  }

  /** 将所有设置恢复为内置默认值；二次确认后立即写入本地并同步到应用 */
  const handleRestoreDefaultSettings = () => {
    if (!confirm(t('settings.confirmRestore'))) return
    if (!confirm(t('settings.confirmRestore2'))) return
    const next = JSON.parse(JSON.stringify(DEFAULT_SETTINGS))
    setForm(next)
    previewAppTheme(next.appTheme)
    onTerminalFontFamilyPreview?.(next.terminalFontFamily)
    saveSettings(next)
    onSave(next)
    alert(t('settings.restored'))
  }

  /** 
   * 选择目录后主进程校验路径（与 log:write 一致）；不允许则提示且不写入表单
   * @param rawPath 原始路径
   */
  const applyChosenLogPath = async (rawPath: string) => {
    const p = String(rawPath ?? '').trim()
    if (!p) return
    const likelyAbsolute =
      p.startsWith('/') ||
      p.startsWith('\\') ||
      /^[a-zA-Z]:[\\/]/.test(p)
    try {
      if (window.zterm?.paths?.validateLogDirectory && likelyAbsolute) {
        const vr = await window.zterm.paths.validateLogDirectory(p)
        if (alertIpcFailure(t, vr, 'settings.logPathRejected')) return
      }
      set('logPath', p)
    } catch (err) {
      alert(t('settings.logPathValidateFail', { msg: err instanceof Error ? err.message : String(err) }))
    }
  }

  /** 处理选择日志路径的操作，兼容使用不同的 API 弹出目录选择对话框，选择后更新日志路径设置 */
  const handleChooseLogPath = async () => {
    try {
      if (window.zterm?.paths?.chooseOpen) {
        const picked = await window.zterm.paths.chooseOpen('logSave')
        if (isIpcSuccess(picked) && !picked?.content?.canceled) {
          const logPath = picked.content.path
          if (typeof logPath === 'string' && logPath) {
            await applyChosenLogPath(logPath)
          }
        }
      } else if (window.showDirectoryPicker) {
        const dir = await window.showDirectoryPicker()
        await applyChosenLogPath(dir.name)
      } else {
        const el = document.createElement('input')
        el.type = 'file'
        el.webkitdirectory = true
        el.onchange = async () => {
          const f = el.files?.[0]
          if (!f) return
          const diskPath =
            typeof window.zterm?.paths?.getPathForFile === 'function'
              ? window.zterm.paths.getPathForFile(f)
              : (typeof f.path === 'string' ? f.path : '')
          if (!diskPath) return
          const dirPath = diskPath.replace(/[/\\][^/\\]*$/, '')
          await applyChosenLogPath(dirPath)
        }
        el.click()
      }
    } catch {}
  }

  /** 处理重置日志路径的操作，将日志路径设置恢复为默认值 */
  const handleResetLogPath = () => set('logPath', '')

  /** 清空主进程加密库中的全部敏感凭据（不删除已保存会话条目） */
  const handleClearAllVaultSecrets = async () => {
    if (!confirm(t('settings.confirmClearVault'))) return
    if (!confirm(t('settings.confirmClearVault2'))) return
    try {
      await clearAllVaultEntries()
      alert(t('settings.clearedVault'))
    } catch (e) {
      alert(t('settings.clearVaultFail', { msg: e instanceof Error ? e.message : String(e) }))
    }
  }

  /** 清空已保存的 SSH 已知主机公钥存储 */
  const handleClearKnownHosts = async () => {
    if (!confirm(t('settings.confirmClearKnownHosts'))) return
    try {
      const res = await getZterm().others.clearKnownHosts()
      if (alertIpcFailure(t, res)) return
      alert(t('settings.clearedKnownHosts'))
    } catch (e) {
      alert(t('settings.clearKnownHostsFail', { msg: e instanceof Error ? e.message : String(e) }))
    }
  }

  /** 设置操作按钮回调函数 */
  const settingsActions: Record<SettingsActionKey, () => void | Promise<void>> = {
    resetAlgorithmPreferences,  // 重置算法偏好设置
    resetHighlightRules: handleResetHighlightRules,  // 重置高亮规则
    addHighlightRule,  // 添加高亮规则
    clearVault: handleClearAllVaultSecrets,  // 清除加密库中的全部敏感凭据
    clearKnownHosts: handleClearKnownHosts,  // 清除 SSH 已知主机公钥存储
    exportSessions: handleExport,  // 导出会话
    importSessions: () => { void triggerImportSessions() },
    clearAllSessions: handleClearAll,  // 清除所有会话
    exportSettings: handleExportSettings,  // 导出设置
    importSettings: () => { void handleImportSettings() },
    restoreDefaultSettings: handleRestoreDefaultSettings,  // 恢复默认设置
  }

  /** 设置区块组件属性，传递给 SettingsGenericSection 组件 */
  const sectionProps = {
    /** 表单数据 */
    form,
    /** 国际化翻译函数 */
    t,
    /** 加密存储可用性 */
    vaultEncryptionAvailable,
    /** 算法类别列表 */
    algorithmSections,
    /** 设置操作 */
    set,
    /** 设置操作 */
    settingsActions,
    /** 选择日志路径回调 */
    onChooseLogPath: handleChooseLogPath,
    /** 重置日志路径回调 */
    onResetLogPath: handleResetLogPath,
    /** 切换算法选项回调 */
    toggleAlgorithmOption,
    /** 移动算法选项回调 */
    moveAlgorithmOption,
    /** 重置算法类别回调 */
    resetAlgorithmSection,
    /** 更新高亮规则回调 */
    updateHighlightRule,
    /** 删除高亮规则回调 */
    removeHighlightRule,
    /** 显示设置悬停提示回调 */
    showSettingsHoverTip,
    /** 隐藏设置悬停提示回调 */
    hideSettingsHoverTip,
  }

  return (
    <div className="dialog-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      {settingsHoverTip && (
        <div
          className="settings-hover-tip"
          role="tooltip"
          style={{ left: settingsHoverTip.x, top: settingsHoverTip.y }}
        >
          {settingsHoverTip.text}
        </div>
      )}
      <div className="dialog settings-dialog">
        <div className="dialog-header">
          <div className="settings-title"><span className="settings-title-icon">⚙ </span>{t('settings.title')}</div>
          <button className="dialog-close" onClick={onClose}>×</button>
        </div>

        <div className="settings-body" onScroll={hideSettingsHoverTip}>
          <div className="dialog-tabs settings-dialog-tabs">
            {tabs.map(tab => (
              <button
                key={tab.key}
                type="button"
                className={`dialog-tab ${activeTab === tab.key ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="settings-tab-panels">
            {(SETTINGS_TAB_SECTION_IDS[activeTab as SettingsTabKey] || []).map((id: string) => {
              const section = SETTINGS_SCHEMA.find((s) => s.section === id)
              return section ? (
                <Fragment key={id}>
                  <SettingsGenericSection sectionDef={section as SettingsGenericSectionDef} {...sectionProps} />
                </Fragment>
              ) : null
            })}
          </div>
        </div>

        <div className="dialog-footer">
          <button type="button" className="btn-cancel" onClick={onClose}>{t('settings.cancel')}</button>
          <button type="button" className="btn-save" onClick={handleSave}>{t('settings.save')}</button>
          <button type="button" className="btn-save-connect" onClick={handleSaveAndClose}>{t('settings.saveClose')}</button>
        </div>
      </div>
    </div>
  )
}

export default function SettingsDialog(props: SettingsDialogProps) {
  const [form, setForm] = useState<AppSettings>({
    ...props.settings,
    highlightRules: props.settings.highlightRules ? [...props.settings.highlightRules] : [],
    algorithmPreferences: props.settings.algorithmPreferences || DEFAULT_ALGORITHM_SELECTION,
  })

  return (
    <I18nProvider language={form.uiLanguage ?? 'auto'}>
      <SettingsDialogContent {...props} form={form} setForm={setForm} />
    </I18nProvider>
  )
}
