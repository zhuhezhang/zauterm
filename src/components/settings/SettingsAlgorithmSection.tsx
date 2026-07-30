import { useState } from 'react'
import { SSH_ALGORITHM_OPTION_POOL, isWeakSshAlgorithm, type AlgorithmCategory } from '../../../shared/sshAlgorithmDefaults'
import type { AppSettings } from '@/types/settings'
import type { SettingsAlgorithmSectionDef } from '@/types/settings'
import type { TranslateFn } from '@/types/common'
import type { SettingsActionKey } from '@/types/settings'

/** 算法区块组件属性 */
export interface SettingsAlgorithmSectionProps {
  /** 区块定义 */
  sectionDef: SettingsAlgorithmSectionDef
  /** 表单数据 */
  form: AppSettings
  /** 国际化翻译函数 */
  t: TranslateFn
  /** 算法类别列表（下拉选项） */
  algorithmSections: { key: AlgorithmCategory; label: string }[]
  /** 设置操作 */
  settingsActions: Record<SettingsActionKey, () => void | Promise<void>>
  /** 切换算法选项 */
  toggleAlgorithmOption: (type: AlgorithmCategory, value: string) => void
  /** 移动算法选项 */
  moveAlgorithmOption: (type: AlgorithmCategory, value: string, direction: number) => void
  /** 重置算法类别 */
  resetAlgorithmSection: (type: AlgorithmCategory) => void
  /** 显示设置悬停提示 */
  showSettingsHoverTip: (e: React.MouseEvent | React.FocusEvent, text: string) => void
  /** 隐藏设置悬停提示 */
  hideSettingsHoverTip: () => void
}

/** 算法区块组件 */
export default function SettingsAlgorithmSection({
  sectionDef,
  form,
  t,
  algorithmSections,
  settingsActions,
  toggleAlgorithmOption,
  moveAlgorithmOption,
  resetAlgorithmSection,
  showSettingsHoverTip,
  hideSettingsHoverTip,
}: SettingsAlgorithmSectionProps) {
  const [activeAlgoSection, setActiveAlgoSection] = useState('kex')  // 默认选中密钥交换算法类别
  const algoCategory = algorithmSections.find((item) => item.key === activeAlgoSection) || algorithmSections[0]  // 获取当前选中的算法类别
  const algoKey = algoCategory.key as AlgorithmCategory  // 获取当前选中的算法类别对应的算法键
  const selected = form.algorithmPreferences?.[algoKey] || []  // 获取当前选中的算法选项
  const options = SSH_ALGORITHM_OPTION_POOL[algoKey] || []  // 获取当前选中的算法类别对应的算法选项

  return (
    <div className="settings-section">
      <div className="settings-section-title">{t(`settings.sections.${sectionDef.section}`)}</div>
      <div className="settings-items">
        {sectionDef.header ? (
          <div className="settings-item">
            <div className="settings-item-info">
              <span className="settings-item-label">{t(sectionDef.header.labelKey)}</span>
              {sectionDef.header.descKey ? (
                <span className="settings-item-desc">{t(sectionDef.header.descKey)}</span>
              ) : null}
            </div>
            <div className="settings-item-actions">
              {sectionDef.header.actions?.map((act) => (
                <button
                  key={act.action}
                  type="button"
                  className="settings-action-btn"
                  onClick={() => settingsActions[act.action]?.()}
                >
                  {t(act.buttonKey)}
                </button>
              ))}
              <button type="button" className="settings-action-btn" onClick={() => resetAlgorithmSection(algoCategory.key)}>
                {t('settings.resetSection')}
              </button>
              <select className="settings-select" value={activeAlgoSection} onChange={(e) => setActiveAlgoSection(e.target.value)}>
                {algorithmSections.map((item) => (
                  <option key={item.key} value={item.key}>{item.label}</option>
                ))}
              </select>
            </div>
          </div>
        ) : null}
        <div className="settings-algo-block">
          {selected.map((value, index) => (
            <div key={value} className="settings-algo-row">
              <label className="settings-algo-label">
                <input type="checkbox" checked onChange={() => toggleAlgorithmOption(algoCategory.key, value)} />
                <span>{value}</span>
                {isWeakSshAlgorithm(algoCategory.key, value) && (
                  <span
                    className="settings-algo-weak-badge"
                    onMouseEnter={(e) => showSettingsHoverTip(e, t('settings.weakTip'))}
                    onMouseLeave={hideSettingsHoverTip}
                  >
                    {t('settings.weakBadge')}
                  </span>
                )}
              </label>
              <div className="settings-algo-actions">
                <button className="settings-algo-btn" type="button" disabled={index <= 0} onClick={() => moveAlgorithmOption(algoCategory.key, value, -1)}>↑</button>
                <button className="settings-algo-btn" type="button" disabled={index === selected.length - 1} onClick={() => moveAlgorithmOption(algoCategory.key, value, 1)}>↓</button>
              </div>
            </div>
          ))}
          {options.filter((value) => !selected.includes(value)).map((value) => (
            <div key={value} className="settings-algo-row">
              <label className="settings-algo-label">
                <input type="checkbox" checked={false} onChange={() => toggleAlgorithmOption(algoCategory.key, value)} />
                <span>{value}</span>
                {isWeakSshAlgorithm(algoCategory.key, value) && (
                  <span
                    className="settings-algo-weak-badge"
                    onMouseEnter={(e) => showSettingsHoverTip(e, t('settings.weakTip'))}
                    onMouseLeave={hideSettingsHoverTip}
                  >
                    {t('settings.weakBadge')}
                  </span>
                )}
              </label>
              <div className="settings-algo-actions">
                <button className="settings-algo-btn" type="button" disabled>↑</button>
                <button className="settings-algo-btn" type="button" disabled>↓</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
