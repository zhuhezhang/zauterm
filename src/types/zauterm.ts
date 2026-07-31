/** 渲染进程：将 ZauTermApi 挂到 window.zauterm（须保留 import，故用 .ts 而非纯 .d.ts） */
import type { ZauTermApi } from '@/lib/ipc/zauterm-api'

declare global {
  interface Window {
    zauterm?: ZauTermApi
  }
}

export {}
