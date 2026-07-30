// 界面语言解析 (渲染进程: 设置里可存 auto, 对外与主进程同步时解析为 zh/en)

/** 
 * 从语言标签列表解析 zh / en
 * @param tags 语言标签列表
 * @returns 解析后的语言
 */
export function detectLangFromLocaleTags(tags: string[]) {
  for (const tag of tags) {
    const lower = String(tag || '').toLowerCase()
    if (lower === 'zh' || lower.startsWith('zh-')) return 'zh'
    if (lower === 'en' || lower.startsWith('en-')) return 'en'
  }
  return 'en'
}

/**
 * 检测系统语言，优先使用 navigator.languages，然后使用 navigator.language
 * @returns 检测到的语言
 */
function detectSystemUiLang() {
  const candidates = []
  try {
    if (typeof navigator !== 'undefined' && Array.isArray(navigator.languages) && navigator.languages.length) {
      candidates.push(...navigator.languages)
    } else if (typeof navigator !== 'undefined' && navigator.language) {
      candidates.push(navigator.language)
    }
  } catch {}
  return detectLangFromLocaleTags(candidates)
}

/**
 * 将设置中的 uiLanguage 解析为实际用于文案的 zh / en
 * @param stored `auto` | `zh` | `en`
 * @param systemLang `auto` 时使用的系统语言
 * @returns 解析后的语言
 */
export function resolveEffectiveUiLanguage(
  stored?: string,
  systemLang?: 'zh' | 'en',
): 'zh' | 'en' {
  if (stored === 'en') return 'en'
  if (stored === 'zh') return 'zh'
  const sys = systemLang ?? detectSystemUiLang()
  return sys === 'zh' ? 'zh' : 'en'
}

/** 
 * 同步界面语言至主进程 (仅传 zh/en, 不传 auto) 
 * @param stored `auto` | `zh` | `en`
 */
export function syncUiLanguageToMain(stored?: string) {
  try {
    window.zterm?.others?.setUiLanguage?.(resolveEffectiveUiLanguage(stored))
  } catch {}
}
