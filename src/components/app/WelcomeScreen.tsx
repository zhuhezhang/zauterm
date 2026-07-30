import { useI18n } from '@/context/I18nContext'
import { useAppVersion } from '@/hooks/useAppVersion'
import type { WelcomeScreenProps } from '@/types/components'
import type { SessionType } from '@/types/session'
import { ConnectionTypeIcon } from '../common'

/** 欢迎屏幕组件 */
export default function WelcomeScreen({ onNewSession }: WelcomeScreenProps) {
  const { t } = useI18n()
  const version = useAppVersion()
  return (
    <div className="welcome">
      <div className="welcome-logo">
        <span className="welcome-title">ZTerm</span>
        <span className="welcome-sub">{t('welcome.subtitle')}</span>
        {version ? (
          <span className="welcome-version">{'v' + version}</span>
        ) : null}
      </div>
      <div className="welcome-actions">
        {[{type:'ssh',icon:ConnectionTypeIcon.ssh,label:'SSH',desc:t('welcome.sshDesc')},
          {type:'telnet',icon:ConnectionTypeIcon.telnet,label:'Telnet',desc:t('welcome.telnetDesc')},
          {type:'serial',icon:ConnectionTypeIcon.serial,label:'Serial',desc:t('welcome.serialDesc')}].map(b => (
          <button key={b.type} className="welcome-btn" onClick={() => onNewSession(b.type as SessionType)}>
            <span className="welcome-btn-icon">{b.icon}</span>
            <span className="welcome-btn-label">{b.label}</span>
            <span className="welcome-btn-desc">{b.desc}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
