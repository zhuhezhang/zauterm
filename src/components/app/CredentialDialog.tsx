import { useRef, useState, type RefObject } from 'react'
import { useDismissOnEscape } from '@/hooks/useDismissOnEscape'
import { useI18n } from '@/context/I18nContext'
import { PrivateKeyField } from '@/components/connect/PrivateKeyField'
import type { CredentialDialogProps } from '@/types/components'
import '@/styles/dialog.css'

/** 凭证对话框组件 */
export default function CredentialDialog({
  username,
  password,
  privateKey,
  passphrase,
  session,
  saveSecretsToVault,
  onConnect,
  onSaveAndConnect,
  onClose,
}: CredentialDialogProps) {
  useDismissOnEscape(true, onClose)
  const { t } = useI18n()
  const [user, setUser] = useState(username || '')
  const [pass, setPass] = useState(password || '')
  const [pkey, setPkey] = useState(privateKey || '')
  const [pphrase, setPphrase] = useState(passphrase || '')
  const userRef = useRef<HTMLInputElement>(null)
  const passRef = useRef<HTMLInputElement>(null)
  const pkeyRef = useRef<HTMLTextAreaElement>(null)
  /** 是否为私钥认证 */
  const keyAuth = session?.authType === 'privateKey'
  /** 是否有用户名 */
  const hasUser = user?.trim()
  /** 是否有密码 */
  const hasPass = pass?.trim()
  /** 是否有私钥 */
  const hasPkey = pkey?.trim()
  /** 是否自动聚焦用户名（用户名为空时聚焦到用户名输入框） */
  const autoFocusUser = !hasUser
  /** 是否可以保存（存在保存会话ID） */
  const canSave = !!session?.savedId
  /** 提交连接 */
  const submitConnect = () => onConnect(user, pass, pkey, pphrase)
  /** 提交保存并连接 */
  const submitSaveAndConnect = () => void onSaveAndConnect(user, pass, pkey, pphrase)

  /** 处理输入框回车事件 */
  const handleEnter = (field: 'user' | 'pkey' | 'pass' | 'passphrase') => {
    /** 必填项 */
    const required: { id: 'user' | 'pkey' | 'pass'; ref: RefObject<HTMLInputElement | HTMLTextAreaElement | null>; value: string }[] = keyAuth
      ? [
          { id: 'user', ref: userRef, value: user },
          { id: 'pkey', ref: pkeyRef, value: pkey },
        ]
      : [
          { id: 'user', ref: userRef, value: user },
          { id: 'pass', ref: passRef, value: pass },
        ]

    if (field !== 'passphrase') {
      const current = required.find(item => item.id === field)
      if (current && !current.value.trim()) {  // 如果当前项为空，则聚焦到当前项的输入框
        current.ref.current?.focus()
        return
      }
    }

    const firstEmpty = required.find(item => !item.value.trim())  // 找到第一个为空的项
    if (firstEmpty) {
      firstEmpty.ref.current?.focus()  // 第一个空的项聚焦到输入框
      return
    }

    if (canSave) submitSaveAndConnect()
    else submitConnect()
  }

  return (
    <div className="dialog-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="dialog">
        <div className="dialog-header">
          <div className="dialog-tabs">{t('credential.title')}</div>
          <button className="dialog-close" onClick={onClose}>×</button>
        </div>
        <div className="dialog-body">
          <div className="form-row">
            <label className="form-label">{t('credential.username')}</label>
            <div className="form-control">
              <input
                ref={userRef}
                value={user}
                autoFocus={autoFocusUser}
                onChange={e => setUser(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleEnter('user')}
              />
            </div>
          </div>
          {keyAuth ? (
            <>
              <div className="form-row form-row-top-align">
                <label className="form-label">{t('credential.privateKeyPath')}</label>
                <div className="form-control">
                  <PrivateKeyField
                    ref={pkeyRef}
                    placeholder={t('connect.privateKeyPh')}
                    value={pkey}
                    autoFocus={!!hasUser && !hasPkey}
                    onChange={setPkey}
                    onSubmit={() => handleEnter('pkey')}
                  />
                </div>
              </div>
              <div className="form-row">
                <label className="form-label">{t('credential.keyPassphrase')}</label>
                <div className="form-control">
                  <input
                    type="password"
                    placeholder={t('credential.optional')}
                    value={pphrase}
                    onChange={e => setPphrase(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleEnter('passphrase')}
                  />
                </div>
              </div>
            </>
          ) : (
            <div className="form-row">
              <label className="form-label">{t('credential.password')}</label>
              <div className="form-control">
                <input
                  ref={passRef}
                  type="password"
                  value={pass}
                  autoFocus={!autoFocusUser && !hasPass}
                  onChange={e => setPass(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleEnter('pass')}
                />
              </div>
            </div>
          )}
          {canSave && (
            <p className="cred-dialog-hint">
              {saveSecretsToVault ? t('credential.hintSaveOn') : t('credential.hintSaveOff')}
            </p>
          )}
        </div>
        <div className="dialog-footer">
          <button type="button" className="btn-cancel" onClick={onClose}>{t('credential.cancel')}</button>
          <button type="button" className="btn-connect" onClick={submitConnect}>{t('credential.connect')}</button>
          <button type="button" className="btn-save-connect" disabled={!canSave} onClick={submitSaveAndConnect} title={canSave ? '' : t('credential.notSavedSession')}>{t('credential.saveConnect')}</button>
        </div>
      </div>
    </div>
  )
}
