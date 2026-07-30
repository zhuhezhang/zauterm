import type { HighlightRule } from '../../types/settings'
import type { AppSettings } from '../../types/settings'

/** 编译后的高亮规则 */
interface CompiledHighlightRule {
  /** 正则表达式 */
  regex: RegExp
  /** ANSI 颜色代码 */
  ansi: string
}

/** 缓存的高亮规则源 */
let cachedRuleSource: HighlightRule[] | null = null
/** 编译后的高亮规则 */
let compiledRules: CompiledHighlightRule[] = []

/**
 * 解析十六进制颜色字符串，支持 #RGB 和 #RRGGBB 格式，返回 RGB 数组
 * @returns RGB 数组，如果输入无效则返回黄色 [255, 255, 0] 作为默认值
 */
function parseHexColor(hex: string): [number, number, number] {
  if (!hex || typeof hex !== 'string') return [255, 255, 0]
  let raw = hex.trim()
  if (raw.startsWith('#')) raw = raw.slice(1)
  if (raw.length === 3) raw = raw.split('').map(ch => ch + ch).join('')
  if (raw.length !== 6) return [255, 255, 0]
  const value = parseInt(raw, 16)
  if (Number.isNaN(value)) return [255, 255, 0]
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

/**
 * 编译高亮规则
 * @param settings 设置
 * @returns 编译后的高亮规则
 */
function compileHighlightRules(settings: AppSettings | undefined): CompiledHighlightRule[] {
  const rules = settings?.highlightRules
  if (rules === cachedRuleSource) return compiledRules
  cachedRuleSource = rules ?? null
  compiledRules = []
  if (!rules?.length) return compiledRules

  for (const rule of rules) {
    if (!rule?.enabled || !rule.pattern?.trim()) continue
    try {
      const pattern = rule.useRegex === false
        ? String(rule.pattern).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        : rule.pattern
      const flags = rule.caseSensitive === true ? 'g' : 'gi'
      const [r, g, b] = parseHexColor(rule.color)
      compiledRules.push({
        regex: new RegExp(pattern, flags),
        ansi: `\x1b[38;2;${r};${g};${b}m`,
      })
    } catch {
      continue
    }
  }
  return compiledRules
}

/**
 * 应用高亮规则（RegExp 在规则变更时预编译，避免每 chunk 重建）
 * @param text 文本
 * @param settings 设置
 * @returns 应用高亮规则后的文本
 */
export function applyHighlightRules(text: string, settings: AppSettings | undefined): string {
  if (!text) return text
  const rules = compileHighlightRules(settings)
  if (!rules.length) return text
  let output = text
  for (const rule of rules) {
    output = output.replace(rule.regex, (match: string) => `${rule.ansi}${match}\x1b[0m`)
  }
  return output
}

/**
 * 返回第一个行结束序列最后一个字符的下标（支持 \r\n、\n、单独 \r），无则 -1。
 * 串口常按字节小块到达，高亮需在累积文本上匹配；按行切分可减少跨块断词
 * @param s 文本
 * @returns 第一个行结束序列最后一个字符的下标
 */
export function nextLineBreakEndIndex(s: string): number {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    if (c === 0x0a) return i
    if (c === 0x0d) {
      if (s.charCodeAt(i + 1) === 0x0a) return i + 1
      return i
    }
  }
  return -1
}
