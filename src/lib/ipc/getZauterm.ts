import type { ZauTermApi } from '@/lib/ipc/zauterm-api'

/**
 * 渲染进程内获取 preload 暴露的 bridge；不可用时抛错供调用方 catch
 * @returns ZauTermApi
 */
export function getZauterm(): ZauTermApi {
  const api = window.zauterm
  if (!api) {
    throw new Error('window.zauterm is not available')
  }
  return api
}
