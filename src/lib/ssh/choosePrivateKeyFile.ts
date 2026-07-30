import { alertIpcFailure } from '@/lib/ipc/formatIpcError'
import { getZterm } from '@/lib/ipc/getZterm'
import { isIpcSuccess } from '@/lib/ipc/ipcResponse'
import type { TranslateFn } from '@/types/common'

/**
 * 弹出文件选择框并读取私钥 PEM 内容；取消时返回 null，失败时 alert 并返回 null
 * @param t 翻译函数
 * @returns 私钥 PEM 内容或 null
 */
export async function choosePrivateKeyFile(t: TranslateFn): Promise<string | null> {
  const res = await getZterm().paths.chooseOpen('privateKey')
  if (isIpcSuccess(res)) {
    if (res.content.canceled) return null
    const content = res.content.content
    return typeof content === 'string' && content ? content : null
  }
  alertIpcFailure(t, res, 'connect.privateKeyChooseFail')
  return null
}
