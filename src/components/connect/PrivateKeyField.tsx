import { forwardRef, useCallback, type KeyboardEvent } from 'react'
import { useI18n } from '@/context/I18nContext'
import { formatThrownIpcError } from '@/lib/ipc/formatIpcError'
import { choosePrivateKeyFile } from '@/lib/ssh/choosePrivateKeyFile'

interface PrivateKeyFieldProps {
  /** 私钥值 */
  value: string
  /** 私钥值变化回调 */
  onChange: (value: string) => void
  /** 占位符 */
  placeholder?: string
  /** Cmd/Ctrl+Enter 触发（多行输入时 Enter 保留换行） */
  onSubmit?: () => void
  /** 自动聚焦 */
  autoFocus?: boolean
}

/** SSH 私钥输入：支持 PEM 内容或文件路径，右侧可浏览选择文件 */
export const PrivateKeyField = forwardRef<HTMLTextAreaElement, PrivateKeyFieldProps>(
  function PrivateKeyField({ value, onChange, placeholder, onSubmit, autoFocus }, ref) {
    const { t } = useI18n()

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        onSubmit?.()
      }
    }

    const handleBrowse = useCallback(async () => {
      try {
        const content = await choosePrivateKeyFile(t)
        if (content) onChange(content)
      } catch (e) {
        alert(formatThrownIpcError(t, e) || t('connect.privateKeyChooseFail'))
      }
    }, [onChange, t])

    return (
      <div className="dialog-private-key-row">
        <textarea
          ref={ref}
          className="dialog-private-key-input"
          value={value}
          placeholder={placeholder}
          autoFocus={autoFocus}
          rows={5}
          wrap="off"
          spellCheck={false}
          onChange={e => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button
          type="button"
          className="dialog-private-key-browse"
          onClick={() => void handleBrowse()}
        >
          {t('connect.privateKeyBrowse')}
        </button>
      </div>
    )
  },
)
