import type { ZTermApi } from '../../../shared/zterm-api'

/**
 * 渲染进程内获取 preload 暴露的 bridge；不可用时抛错供调用方 catch
 * @returns ZTermApi
 */
export function getZterm(): ZTermApi {
  const api = window.zterm
  if (!api) {
    throw new Error('window.zterm is not available')
  }
  return api
}
