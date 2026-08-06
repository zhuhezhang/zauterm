import type { KeyboardEvent } from 'react'
import { useI18n } from '@/context/I18nContext'
import type { SessionFormFieldsProps } from '@/types/components'
import FormRow from './FormRow'

/** 本机 Shell 表单组件；visible 为 false 时不渲染 */
export default function LocalForm({ form, set, visible, onEnter }: SessionFormFieldsProps) {
  const { t } = useI18n()
  const handleEnter = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') onEnter?.()
  }
  if (!visible) return null
  return (
    <>
      <FormRow label={t('connect.shell')}>
        <input
          placeholder={t('connect.shellPh')}
          value={form.shell ?? ''}
          onChange={e => set('shell', e.target.value)}
          onKeyDown={handleEnter}
          autoFocus
        />
      </FormRow>
      <FormRow label={t('connect.cwd')}>
        <input
          placeholder={t('connect.cwdPh')}
          value={form.cwd ?? ''}
          onChange={e => set('cwd', e.target.value)}
          onKeyDown={handleEnter}
        />
      </FormRow>
    </>
  )
}
