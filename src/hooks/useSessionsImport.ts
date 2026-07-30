import { useCallback } from 'react'
import { useI18n } from '@/context/I18nContext'
import { applySessionsImportFromContent, reportSessionsImportResult } from '@/lib/import/applySessionsImport'
import { reportImportError } from '@/lib/import/handleImportErrors'
import { alertIpcFailure } from '@/lib/ipc/formatIpcError'
import { getZterm } from '@/lib/ipc/getZterm'
import { absorbPlaintextSecretsFromImportedSessions } from '@/store/credentialsBridge'
import type { SavedSession } from '@/types/session'

/**
 * 使用会话导入（主进程打开文件对话框）
 * @param savedSessions 保存的会话
 * @param onUpdateSessions 更新会话回调
 * @returns 触发导入
 */
export function useSessionsImport(
  savedSessions: SavedSession[],
  onUpdateSessions: (sessions: SavedSession[]) => void,
) {
  const { t } = useI18n()

  const triggerImport = useCallback(async () => {
    try {
      const picked = await getZterm().paths.chooseOpen('importSessions')
      if (!picked?.success) {
        alertIpcFailure(t, picked, 'settings.importFail')
        return
      }
      if (picked.content.canceled) return
      const content = picked.content.content
      if (typeof content !== 'string') return

      const result = await applySessionsImportFromContent(
        content,
        savedSessions,
        absorbPlaintextSecretsFromImportedSessions,
      )
      onUpdateSessions(result.sessions)
      reportSessionsImportResult(t, result)
    } catch (err) {
      reportImportError(t, err)
    }
  }, [savedSessions, onUpdateSessions, t])

  return { triggerImport }
}
