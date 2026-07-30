/**
 * 渲染进程终端编码服务：IPC binary 线 → xterm Unicode；UI 编码选项。
 * 解码仅用 TextDecoder；编码写入远端由主进程 terminalEncodingService 负责。
 */
import {
  DEFAULT_TERMINAL_ENCODING,
  normalizeTerminalEncoding,
} from '../../shared/terminalEncoding'

/** 连接对话框编码下拉 */
export const TERMINAL_ENCODING_OPTIONS = [
  { value: DEFAULT_TERMINAL_ENCODING, label: 'UTF-8' },
  { value: 'gbk', label: 'GBK / CP936（简体中文）' },
  { value: 'gb18030', label: 'GB18030（中文国标）' },
  { value: 'gb2312', label: 'GB2312（按 GBK 处理）' },
  { value: 'big5', label: 'Big5（繁体中文）' },
  { value: 'utf-16le', label: 'UTF-16 LE' },
  { value: 'latin1', label: 'Latin-1 (ISO-8859-1)' },
]

/** 解码器缓存 */
const decoderCache = new Map<string, TextDecoder>()

/**
 * 获取解码器
 * @param encoding 编码
 * @returns 解码器
 */
function getTextDecoder(encoding: string) {
  const key = normalizeTerminalEncoding(encoding)
  if (decoderCache.has(key)) return decoderCache.get(key)!
  let dec
  try {
    dec = new TextDecoder(key, { fatal: false, ignoreBOM: true })
  } catch {
    dec = new TextDecoder(DEFAULT_TERMINAL_ENCODING, { fatal: false, ignoreBOM: true })
  }
  decoderCache.set(key, dec)
  return dec
}

/**
 * 主进程经 binary 线传来的字节流 → Unicode（供 xterm.write）
 * @param binary 字节流
 * @param encoding 编码
 * @returns Unicode
 */
export function decodeIncomingTerminalWire(binary: string, encoding?: string) {
  if (binary == null || binary === '') return ''
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i) & 0xff
  try {
    return getTextDecoder(encoding ?? DEFAULT_TERMINAL_ENCODING).decode(bytes)
  } catch {
    return new TextDecoder(DEFAULT_TERMINAL_ENCODING, { fatal: false }).decode(bytes)
  }
}
