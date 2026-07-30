import { normalizeLoggingMode, clampSettingsNumberField } from '@/lib/settings/normalize'
import { getDefaultLogPath } from '@/store/settingsStore'
import type { AppSettings } from '@/types/settings'
import type { SettingsActionKey, SettingsSchemaItem } from '@/types/settings'
import type { TranslateFn } from '@/types/common'

/** 设置项组件属性 */
export interface SettingsSettingItemProps {
  /** 设置项定义 */
  item: SettingsSchemaItem
  /** 表单数据 */
  form: AppSettings
  /** 国际化翻译函数 */
  t: TranslateFn
  /** 加密存储可用性 */
  vaultEncryptionAvailable: boolean | null
  /** 设置操作 */
  set: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void
  /** 设置操作 */
  settingsActions: Record<SettingsActionKey, () => void | Promise<void>>
  /** 选择日志路径回调 */
  onChooseLogPath: () => void
  /** 重置日志路径回调 */
  onResetLogPath: () => void
  /** 显示设置悬停提示回调 */
  showSettingsHoverTip: (e: React.MouseEvent | React.FocusEvent, text: string) => void
  /** 隐藏设置悬停提示回调 */
  hideSettingsHoverTip: () => void
}

/** 设置项组件 */
export default function SettingsSettingItem({
  item,
  form,
  t,
  vaultEncryptionAvailable,
  set,
  settingsActions,
  onChooseLogPath,
  onResetLogPath,
  showSettingsHoverTip,
  hideSettingsHoverTip,
}: SettingsSettingItemProps) {
  /** 设置项的键或操作名，如 'terminalScrollback'、'logPath'、'resetAlgorithmPreferences'、'resetHighlightRules'等 */
  const itemKey = item.key || item.action
  /** 设置项的标签，如 '终端滚动缓冲区'、'日志路径'、'重置算法偏好设置'、'重置高亮规则'等 */
  const label = item.labelKey ? t(item.labelKey) : t(`settings.fields.${item.key}.label`)
  /** 设置项的描述，如 '终端滚动缓冲区'、'日志路径'、'重置算法偏好设置'、'重置高亮规则'等 */
  const descParams =
    item.type === 'number' && item.min != null && item.max != null
      ? { min: item.min, max: item.max }
      : undefined
  const desc = item.descKey
    ? t(item.descKey, descParams)
    : (item.key ? t(`settings.fields.${item.key}.desc`, descParams) : '')
  const settingKey = item.key
  /** 日志路径的显示值，如 '~/Downloads/zterm-session-log'、'~/Downloads/zterm-session-log'、'系统下载目录（默认）'等 */
  const logDisplay = (settingKey ? form[settingKey] : '') || getDefaultLogPath() || t('settings.logDefaultDir')
  /** 日志路径的提示路径，如 '~/Downloads/zterm-session-log'、'~/Downloads/zterm-session-log'、'系统下载目录（默认）'等 */
  const logTipPath = (settingKey ? form[settingKey] : '') || getDefaultLogPath() || t('settings.logDefaultDir')
  /** 重置日志路径的提示文本，如 '恢复默认日志目录为：\n~/Downloads/zterm-session-log'等 */
  const logResetTip = t('settings.logResetDefault', { path: getDefaultLogPath() || t('settings.logDefaultDir') })
  /** 日志路径是否禁用，如 true、false等 */
  const logPathDisabled = settingKey === 'logPath' && normalizeLoggingMode(form.loggingMode) === 'none'
  const vaultSaveDisabled =
    settingKey === 'saveSecretsToVault' && vaultEncryptionAvailable === false

  return (
    <div key={String(itemKey)} className={`settings-item${vaultSaveDisabled ? ' is-vault-unavailable' : ''}`}>
      <div className="settings-item-info">
        <span className="settings-item-label">{label}</span>
        {desc ? <span className="settings-item-desc">{desc}</span> : null}
        {vaultSaveDisabled ? (
          <span className="settings-item-hint-warn" role="status">
            {t('settings.vaultEncryptionUnavailableTip')}
          </span>
        ) : null}
      </div>
      {item.type === 'boolean' && settingKey && (
        <button
          type="button"
          className={`settings-toggle ${form[settingKey] ? 'on' : 'off'}`}
          disabled={vaultSaveDisabled}
          aria-disabled={vaultSaveDisabled}
          onClick={() => {
            if (vaultSaveDisabled) return
            set(settingKey, !form[settingKey])
          }}
        >
          <span className="settings-toggle-knob" />
        </button>
      )}
      {item.type === 'action' && item.action && (
        <button
          type="button"
          className={`settings-action-btn${item.danger ? ' danger' : ''}`}
          onClick={() => settingsActions[item.action!]?.()}
        >
          {t(item.buttonKey ?? '')}
        </button>
      )}
      {item.type === 'path' && (
        <div
          className={`settings-path-row${logPathDisabled ? ' is-log-path-disabled' : ''}`}
          onMouseEnter={logPathDisabled ? (e) => showSettingsHoverTip(e, t('settings.logPathDisabledTip')) : undefined}
          onMouseLeave={logPathDisabled ? hideSettingsHoverTip : undefined}
        >
          <input
            className="settings-path-input"
            value={String(logDisplay)}
            placeholder={getDefaultLogPath() || t('settings.logChooseDir')}
            readOnly
            disabled={logPathDisabled}
            aria-label={label}
            onMouseEnter={logPathDisabled ? undefined : (e) => showSettingsHoverTip(e, t('settings.logCurrentDir', { path: String(logTipPath) }))}
            onMouseLeave={logPathDisabled ? undefined : hideSettingsHoverTip}
            onFocus={logPathDisabled ? undefined : (e) => showSettingsHoverTip(e, t('settings.logCurrentDir', { path: String(logTipPath) }))}
            onBlur={logPathDisabled ? undefined : hideSettingsHoverTip}
          />
          <button type="button" className="settings-path-btn" disabled={logPathDisabled} onClick={onChooseLogPath}>{t('settings.choose')}</button>
          <button
            type="button"
            className="settings-path-btn reset"
            aria-label={t('settings.logResetAria')}
            disabled={logPathDisabled}
            onClick={onResetLogPath}
            onMouseEnter={logPathDisabled ? undefined : (e) => showSettingsHoverTip(e, logResetTip)}
            onMouseLeave={logPathDisabled ? undefined : hideSettingsHoverTip}
            onFocus={logPathDisabled ? undefined : (e) => showSettingsHoverTip(e, logResetTip)}
            onBlur={logPathDisabled ? undefined : hideSettingsHoverTip}
          >
            ↺
          </button>
        </div>
      )}
      {item.type === 'select' && settingKey && (
        <select
          className="settings-select"
          value={String(form[settingKey] ?? item.options?.[0]?.value ?? '')}
          onChange={(e) => set(settingKey, e.target.value as AppSettings[typeof settingKey])}
        >
          {(item.options || []).map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.labelKey ? t(opt.labelKey) : opt.value}</option>
          ))}
        </select>
      )}
      {item.type === 'number' && settingKey && (
        <input
          type="number"
          className="settings-number-input"
          min={item.min ?? 0}
          max={item.max}
          step={item.step ?? 1}
          value={String(form[settingKey] ?? '')}
          aria-label={label}
          onChange={(e) => {
            const v = e.target.value
            if (v === '' || v === '-') {
              set(settingKey, v as AppSettings[typeof settingKey])
              return
            }
            const n = Number(v)
            if (!Number.isFinite(n)) return
            set(settingKey, clampSettingsNumberField(settingKey, n) as AppSettings[typeof settingKey])
          }}
          onBlur={() => set(settingKey, clampSettingsNumberField(settingKey, form[settingKey]) as AppSettings[typeof settingKey])}
          title=""
        />
      )}
    </div>
  )
}
