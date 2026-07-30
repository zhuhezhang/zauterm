import { HighlightRegexIcon, HighlightCaseIcon } from './HighlightRuleIcons'
import type { AppSettings, HighlightRule } from '@/types/settings'
import type { SettingsGenericSectionDef } from '@/types/settings'
import type { TranslateFn } from '@/types/common'
import SettingsSectionHeader from './SettingsSectionHeader'
import type { SettingsActionKey } from '@/types/settings'

/** 高亮区块组件属性 */
export interface SettingsHighlightSectionProps {
  /** 区块定义 */
  sectionDef: SettingsGenericSectionDef
  /** 表单数据 */
  form: AppSettings
  /** 国际化翻译函数 */
  t: TranslateFn
  /** 设置操作 */
  settingsActions: Record<SettingsActionKey, () => void | Promise<void>>
  /** 更新高亮规则回调 */
  updateHighlightRule: (id: string, changes: Partial<HighlightRule>) => void
  /** 删除高亮规则回调 */
  removeHighlightRule: (id: string) => void
  /** 显示设置悬停提示回调 */
  showSettingsHoverTip: (e: React.MouseEvent | React.FocusEvent, text: string) => void
  /** 隐藏设置悬停提示回调 */
  hideSettingsHoverTip: () => void
}

/** 高亮区块组件 */
export default function SettingsHighlightSection({
  sectionDef,
  form,
  t,
  settingsActions,
  updateHighlightRule,
  removeHighlightRule,
  showSettingsHoverTip,
  hideSettingsHoverTip,
}: SettingsHighlightSectionProps) {
  return (
    <div className="settings-section">
      <div className="settings-section-title">{t(`settings.sections.${sectionDef.section}`)}</div>
      <div className="settings-items">
        {sectionDef.header ? (
          <SettingsSectionHeader header={sectionDef.header} t={t} settingsActions={settingsActions} />
        ) : null}
        {(form.highlightRules || []).map((rule, idx) => {
          const unnamed = t('settings.unnamedRule', { n: idx + 1 })
          return (
            <div key={rule.id} className="settings-rule-item">
              <div className="settings-rule-top">
                <span className="settings-rule-index">{t('settings.ruleN', { n: idx + 1 })}</span>
                <input
                  className="settings-rule-name-input"
                  type="text"
                  value={rule.name ?? ''}
                  placeholder={t('settings.ruleNamePh')}
                  aria-label={t('settings.ruleNameTip')}
                  onMouseEnter={(e) => showSettingsHoverTip(e, t('settings.ruleNameTip'))}
                  onMouseLeave={hideSettingsHoverTip}
                  onChange={(e) => updateHighlightRule(rule.id, { name: e.target.value })}
                />
                <span className="settings-rule-grid-placeholder" aria-hidden="true" />
                <button
                  type="button"
                  className={`settings-toggle ${rule.enabled ? 'on' : 'off'}`}
                  aria-label={`${(rule.name || '').trim() || unnamed}：${rule.enabled ? t('settings.ruleEnabled') : t('settings.ruleDisabled')}`}
                  onMouseEnter={(e) => showSettingsHoverTip(e, rule.enabled ? t('settings.ruleEnabled') : t('settings.ruleDisabled'))}
                  onMouseLeave={hideSettingsHoverTip}
                  onFocus={(e) => showSettingsHoverTip(e, rule.enabled ? t('settings.ruleEnabled') : t('settings.ruleDisabled'))}
                  onBlur={hideSettingsHoverTip}
                  onClick={() => updateHighlightRule(rule.id, { enabled: !rule.enabled })}
                >
                  <span className="settings-toggle-knob" />
                </button>
              </div>
              <div className="settings-rule-row">
                <button type="button" className="settings-action-btn danger" onClick={() => removeHighlightRule(rule.id)}>{t('settings.delete')}</button>
                <input
                  className="settings-rule-pattern"
                  type="text"
                  value={rule.pattern}
                  placeholder={t('settings.patternPh')}
                  onMouseEnter={(e) => showSettingsHoverTip(e, t('settings.patternTip'))}
                  onMouseLeave={hideSettingsHoverTip}
                  onChange={(e) => updateHighlightRule(rule.id, { pattern: e.target.value })}
                />
                <input
                  className="settings-rule-color"
                  type="color"
                  value={rule.color || '#ffcc00'}
                  aria-label={t('settings.colorTip')}
                  onMouseEnter={(e) => showSettingsHoverTip(e, t('settings.colorTip'))}
                  onMouseLeave={hideSettingsHoverTip}
                  onFocus={(e) => showSettingsHoverTip(e, t('settings.colorTip'))}
                  onBlur={hideSettingsHoverTip}
                  onChange={(e) => updateHighlightRule(rule.id, { color: e.target.value })}
                />
                <div className="settings-rule-icon-toggles" role="group" aria-label={t('settings.matchOptions')}>
                  <button
                    type="button"
                    className={`settings-icon-toggle ${rule.caseSensitive === true ? 'active' : ''}`}
                    aria-label={t('settings.caseAria')}
                    aria-pressed={rule.caseSensitive === true}
                    onMouseEnter={(e) => showSettingsHoverTip(e, rule.caseSensitive === true ? t('settings.caseTipOn') : t('settings.caseTipOff'))}
                    onMouseLeave={hideSettingsHoverTip}
                    onFocus={(e) => showSettingsHoverTip(e, rule.caseSensitive === true ? t('settings.caseTipOn') : t('settings.caseTipOff'))}
                    onBlur={hideSettingsHoverTip}
                    onClick={() => updateHighlightRule(rule.id, { caseSensitive: !rule.caseSensitive })}
                  >
                    <HighlightCaseIcon />
                  </button>
                  <button
                    type="button"
                    className={`settings-icon-toggle ${(rule.useRegex ?? true) ? 'active' : ''}`}
                    aria-label={t('settings.regexAria')}
                    aria-pressed={rule.useRegex ?? true}
                    onMouseEnter={(e) => showSettingsHoverTip(e, (rule.useRegex ?? true) ? t('settings.regexTipOn') : t('settings.regexTipOff'))}
                    onMouseLeave={hideSettingsHoverTip}
                    onFocus={(e) => showSettingsHoverTip(e, (rule.useRegex ?? true) ? t('settings.regexTipOn') : t('settings.regexTipOff'))}
                    onBlur={hideSettingsHoverTip}
                    onClick={() => updateHighlightRule(rule.id, { useRegex: !(rule.useRegex ?? true) })}
                  >
                    <HighlightRegexIcon />
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
