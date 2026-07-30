import { useI18n } from '@/context/I18nContext'
import { useAppVersion } from '@/hooks/useAppVersion'
import { useDismissOnEscape } from '@/hooks/useDismissOnEscape'
import '@/styles/dialog.css'
import '@/styles/about.css'

/** 项目仓库地址 */
const PROJECT_URLS = [
  'https://github.com/zhuhezhang/zterm',
  'https://gitee.com/zhuhezhang/zterm',
] as const

/** 关于对话框 */
export default function AboutDialog({ onClose }: { onClose: () => void }) {
  const { t } = useI18n()
  const version = useAppVersion()
  useDismissOnEscape(true, onClose)

  const openUrl = (url: string) => {
    void window.zterm?.others?.openExternal?.(url)
  }

  return (
    <div className="dialog-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog about-dialog">
        <div className="dialog-header">
          <div className="about-dialog-title">{t('about.title')}</div>
          <button type="button" className="dialog-close" onClick={onClose} aria-label={t('about.close')}>
            ×
          </button>
        </div>
        <div className="dialog-body about-dialog-body">
          <div className="about-hero">
            <span className="about-app-name">⚡ ZTerm</span>
            <span className="about-version">{version ? `v${version}` : '—'}</span>
          </div>
          <div className="about-row">
            <span className="about-label">{t('about.projectUrls')}</span>
            <div className="about-links">
              {PROJECT_URLS.map((url) => (
                <button
                  key={url}
                  type="button"
                  className="about-link"
                  onClick={() => openUrl(url)}
                >
                  {url}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
