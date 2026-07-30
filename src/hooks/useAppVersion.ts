import { useEffect, useState } from 'react'
import { isIpcSuccess } from '@/lib/ipc/ipcResponse'

/**
 * 经 IPC 拉取应用版本号（electron app.getVersion，与 package.json 一致）
 * @returns 应用版本号
 */
export function useAppVersion(): string | null {
  const [version, setVersion] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void window.zterm?.others?.getVersion?.().then((res) => {
      if (cancelled || !isIpcSuccess(res)) return
      const v = res.content?.version
      if (typeof v === 'string' && v.trim()) setVersion(v.trim())
    })
    return () => {
      cancelled = true
    }
  }, [])

  return version
}
