/** App.jsx */
export const APP = {
  zh: {
    saveOutputNotReady: '当前标签页尚未准备好终端输出',
    saveOutputEmpty: '当前标签页暂无可保存的终端输出',
    saveOutputFail: '保存终端输出失败：{msg}',
    saveOutputOk: '终端输出已保存',
    invalidRequest: '无效的请求',
    unauthorized: '未授权的 IPC 请求',
  },
  en: {
    saveOutputNotReady: 'Terminal output is not ready on this tab yet',
    saveOutputEmpty: 'No terminal output to save on this tab',
    saveOutputFail: 'Failed to save terminal output: {msg}',
    saveOutputOk: 'Terminal output saved',
    invalidRequest: 'Invalid request',
    unauthorized: 'Unauthorized IPC request',
  },
}

/** App.jsx — 凭据 IPC (credentialsBridge / handlers/credentials.js) */
export const CREDENTIALS = {
  zh: {
    invalidSavedId: '无效的 savedId',
    encryptionUnavailable:
      '系统安全存储不可用（例如 Linux 未配置密钥环）。无法加密保存凭据。',
  },
  en: {
    invalidSavedId: 'Invalid savedId',
    encryptionUnavailable:
      'Secure storage is unavailable (e.g. no keyring on Linux). Cannot save encrypted credentials.',
  },
}
