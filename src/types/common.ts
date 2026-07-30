/** 跨模块共用的小型类型（i18n、导入、IPC 错误包装） */
import type { IpcResult } from '../../shared/ipc'
import type { SavedSession } from './session'

/** 用户界面语言 */
export type UiLanguage = 'zh' | 'en'

/** 翻译参数 */
export type TranslateParams = Record<string, string | number>

/** 文案翻译；第二参数可选，与 translateRender 一致 */
export type TranslateFn = (path: string, params?: TranslateParams) => string

/** I18n 上下文值 */
export interface I18nContextValue {
  /** 用户界面语言 */
  lang: UiLanguage
  /** 翻译函数 */
  t: TranslateFn
}

// 渲染进程 IPC 错误包装（底层契约见 shared/ipc.ts）

/** 导入错误 */
export interface ImportError extends Error {
  /** 错误码 */
  code: string
  /** 错误参数 */
  params?: Record<string, string | number>
  /** IPC 结果 */
  ipc?: IpcResult
}

/** IPC 抛出错误 */
export interface IpcThrownError extends Error {
  /** 错误参数 */
  errorParams?: Record<string, string | number>
  /** 是否已知错误 */
  errorKnown?: boolean
}

/** 导入/合并流程共用的警告条目 */
export interface ImportWarning {
  /** 警告代码 */
  code: string
  /** 警告参数 */
  params?: Record<string, string | number>
}

/** 会话导入警告 */
export type SessionImportWarning = ImportWarning

/** 设置导入警告 */
export type SettingsImportWarning = ImportWarning

/** normalizeImportedSession 的返回类型 */
export type NormalizeImportedSessionResult =
  | { ok: true; session: SavedSession; warnings: SessionImportWarning[] }
  | { ok: false; reason: string }
