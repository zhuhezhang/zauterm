import type { KeyboardEvent } from 'react'
import { useI18n } from '@/context/I18nContext'
import { PORT_MIN, PORT_MAX } from '@/lib/session/defaults'
import { clampPortFieldString } from '@/lib/session/utils'
import type { SessionFormFieldsProps } from '@/types/components'
import FormRow from './FormRow'

/** Telnet 表单组件；visible 为 false 时不渲染 */
export default function TelnetForm({ form, set, visible, onEnter }: SessionFormFieldsProps) {
  const { t } = useI18n()
  const handleEnter = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') onEnter?.()
  }
  if (!visible) return null
  return (
    <>
      <FormRow label={t('connect.host')}>
        <input placeholder={t('connect.hostPh')} value={form.host} onChange={e => set('host', e.target.value)} onKeyDown={handleEnter} autoFocus />
      </FormRow>
      <FormRow label={t('connect.port')}>
        <input type="number" min={PORT_MIN} max={PORT_MAX} value={form.port} onChange={e => set('port', clampPortFieldString(e.target.value))} onKeyDown={handleEnter} style={{ width: 80 }} />
      </FormRow>
    </>
  )
}
