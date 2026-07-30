import SettingsSettingItem from './SettingsSettingItem'
import SettingsAlgorithmSection from './SettingsAlgorithmSection'
import SettingsHighlightSection from './SettingsHighlightSection'
import type { AlgorithmCategory } from '../../../shared/sshAlgorithmDefaults'
import type { AppSettings, HighlightRule } from '@/types/settings'
import type { SettingsActionKey, SettingsGenericSectionDef, SettingsSchemaItem } from '@/types/settings'
import type { TranslateFn } from '@/types/common'

/** 设置区块组件属性 */
export interface SettingsGenericSectionProps {
  /** 区块定义 */
  sectionDef: SettingsGenericSectionDef
  /** 表单数据 */
  form: AppSettings
  t: TranslateFn
  /** 加密存储可用性 */
  vaultEncryptionAvailable: boolean | null
  /** 算法类别列表 */
  algorithmSections: { key: AlgorithmCategory; label: string }[]
  /** 设置操作 */
  set: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void
  /** 设置操作 */
  settingsActions: Record<SettingsActionKey, () => void | Promise<void>>
  /** 选择日志路径回调 */
  onChooseLogPath: () => void
  /** 重置日志路径回调 */
  onResetLogPath: () => void
  /** 切换算法选项回调 */
  toggleAlgorithmOption: (type: AlgorithmCategory, value: string) => void
  /** 移动算法选项回调 */
  moveAlgorithmOption: (type: AlgorithmCategory, value: string, direction: number) => void
  /** 重置算法类别回调 */
  resetAlgorithmSection: (type: AlgorithmCategory) => void
  /** 更新高亮规则回调 */
  updateHighlightRule: (id: string, changes: Partial<HighlightRule>) => void
  /** 删除高亮规则回调 */
  removeHighlightRule: (id: string) => void
  /** 显示设置悬停提示回调 */
  showSettingsHoverTip: (e: React.MouseEvent | React.FocusEvent, text: string) => void
  /** 隐藏设置悬停提示回调 */
  hideSettingsHoverTip: () => void
}

/** 设置区块组件 */
export default function SettingsGenericSection(props: SettingsGenericSectionProps) {
  const { sectionDef, t } = props  // 获取区块定义和国际化翻译函数

  if (sectionDef.kind === 'algorithm') {  // 渲染算法区块
    return (
      <SettingsAlgorithmSection
        sectionDef={sectionDef}
        form={props.form}
        t={t}
        algorithmSections={props.algorithmSections}
        settingsActions={props.settingsActions}
        toggleAlgorithmOption={props.toggleAlgorithmOption}
        moveAlgorithmOption={props.moveAlgorithmOption}
        resetAlgorithmSection={props.resetAlgorithmSection}
        showSettingsHoverTip={props.showSettingsHoverTip}
        hideSettingsHoverTip={props.hideSettingsHoverTip}
      />
    )
  }

  if (sectionDef.kind === 'highlight') {  // 渲染高亮区块
    return (
      <SettingsHighlightSection
        sectionDef={sectionDef}
        form={props.form}
        t={t}
        settingsActions={props.settingsActions}
        updateHighlightRule={props.updateHighlightRule}
        removeHighlightRule={props.removeHighlightRule}
        showSettingsHoverTip={props.showSettingsHoverTip}
        hideSettingsHoverTip={props.hideSettingsHoverTip}
      />
    )
  }

  return (
    <div className="settings-section">
      <div className="settings-section-title">{t(`settings.sections.${sectionDef.section}`)}</div>
      <div className="settings-items">
        {(sectionDef.items || []).map((item) => (
          <SettingsSettingItem
            key={item.key || item.action}
            item={item as SettingsSchemaItem}
            form={props.form}
            t={t}
            vaultEncryptionAvailable={props.vaultEncryptionAvailable}
            set={props.set}
            settingsActions={props.settingsActions}
            onChooseLogPath={props.onChooseLogPath}
            onResetLogPath={props.onResetLogPath}
            showSettingsHoverTip={props.showSettingsHoverTip}
            hideSettingsHoverTip={props.hideSettingsHoverTip}
          />
        ))}
      </div>
    </div>
  )
}
