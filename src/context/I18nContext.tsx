/**
 * 没有上下文，lang属性只能根据组件一层层往下传，比如<App><SettingsDialog><TerminalPanel>，这样层层传递。
 * 中间组件可能根本不用 language，却不得不接收再转发，很啰嗦。Context 的思路：在树的上层放一个「公共储物柜」，
 * 里面放好 { lang, t }；谁需要就自己打开柜子取，中间层不用传 props，直接用。
 * Context = 通道 / 柜子本身（定义柜子类型 + 默认值）(I18nContext)
 * Provider = 谁在上层往柜子里放了什么(提供者组件)
 * useI18n = 下层谁从柜子里拿什么(使用者组件)
 */
import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { translateRender } from '../i18n/translateRender'
import { resolveEffectiveUiLanguage } from '../lib/resolveUiLanguage'
import type { I18nContextValue } from '../types/common'

/** 默认语言 */
const defaultLang = resolveEffectiveUiLanguage('zh')

/** I18n 上下文 */
const I18nContext = createContext<I18nContextValue>({
  lang: defaultLang,
  t: (path, params) => translateRender(defaultLang, path, params),
})

/**
 * I18n 提供者组件
 * @param language 语言
 * @param children 子组件
 * @returns I18n 提供者组件
 */
export function I18nProvider({
  language,
  children,
}: {
  language?: string
  children: ReactNode
}) {
  const lang = resolveEffectiveUiLanguage(language)  // 解析语言
  const value = useMemo<I18nContextValue>(
    () => ({
      lang,
      t: (path, params) => translateRender(lang, path, params),
    }),
    [lang],
  )
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

/**
 * 使用 I18n
 * @returns I18n 使用者组件
 */
export function useI18n(): I18nContextValue {
  return useContext(I18nContext)
}
