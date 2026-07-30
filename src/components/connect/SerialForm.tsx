import type { KeyboardEvent } from 'react'
import { useI18n } from '@/context/I18nContext'
import { BAUD_RATES, PARITIES } from '@/lib/session/defaults'
import type { SerialFormProps } from '@/types/components'
import FormRow from './FormRow'

/** Serial 表单组件；visible 为 false 时不渲染 */
export default function SerialForm({ form, set, ports, visible, onRefreshPorts, onEnter }: SerialFormProps) {
  const { t } = useI18n()
  const handleEnter = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') onEnter?.()  // 输入框回车时触发保存并连接
  }
  if (!visible) return null
  return (
    <>
      <FormRow label={t('connect.serialPort')}>
        <input
          className="dialog-serial-path-input"
          placeholder={t('connect.serialPh')}
          value={form.path}
          onChange={e => set('path', e.target.value)}
          onKeyDown={handleEnter}
          list="port-list"
          autoFocus
        />
        <button type="button" className="dialog-serial-refresh-btn" onClick={onRefreshPorts}>
          {t('connect.refresh')}
        </button>
        <datalist id="port-list">
          {ports.map((p) => (
            <option key={p.path} value={p.path}>
              {p.path}
              {p.manufacturer ? ` (${p.manufacturer})` : ''}
            </option>
          ))}
        </datalist>
      </FormRow>
      <FormRow label={t('connect.baudRate')}>
        <select value={form.baudRate} onChange={e => set('baudRate', e.target.value)}>
          {BAUD_RATES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </FormRow>
      <FormRow label={t('connect.dataBits')}>
        <select value={form.dataBits} onChange={e => set('dataBits', e.target.value)}>
          {['5', '6', '7', '8'].map(v => <option key={v} value={v}>{v}</option>)}
        </select>
      </FormRow>
      <FormRow label={t('connect.stopBits')}>
        <select value={form.stopBits} onChange={e => set('stopBits', e.target.value)}>
          {['1', '2'].map(v => <option key={v} value={v}>{v}</option>)}
        </select>
      </FormRow>
      <FormRow label={t('connect.parity')}>
        <select value={form.parity} onChange={e => set('parity', e.target.value)}>
          {PARITIES.map(v => <option key={v} value={v}>{v}</option>)}
        </select>
      </FormRow>
    </>
  )
}
