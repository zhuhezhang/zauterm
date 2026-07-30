/** 渲染进程：将 shared/zterm-api 挂到 window.zterm（须保留 import，故用 .ts 而非纯 .d.ts） */
import type { ZTermApi } from '../../shared/zterm-api'

declare global {
  interface Window {
    zterm?: ZTermApi
  }
}

export {}
