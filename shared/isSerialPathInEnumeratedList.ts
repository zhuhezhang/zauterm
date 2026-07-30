/** 枚举项至少含 path，与 serialport list() / listPorts IPC 一致 */
export type SerialPortListEntry = { path?: string }

/**
 * 串口路径是否落在当前枚举列表中（主进程连接前校验 + 渲染进程表单校验须一致）,Windows 上对 COM 路径不区分大小写
 * @param requestedPath 请求的串口路径
 * @param ports 枚举列表
 * @returns 是否在枚举列表中
 */
export function isSerialPathInEnumeratedList(
  requestedPath: string | null | undefined,
  ports: ReadonlyArray<SerialPortListEntry> | null | undefined,
): boolean {
  const req = String(requestedPath ?? '').trim()
  if (!req) return false
  const paths = (ports ?? []).map((p) => p?.path).filter((p): p is string => Boolean(p))  // ”?.“ 表示如果 p 为 null 或 undefined，则返回 undefined；”: p is string“ 表示 p 是 string 类型；”Boolean(p)“ 表示如果 p 为 null 或 undefined，则返回 false，否则返回 true
  if (typeof process !== 'undefined' && process.platform === 'win32') {
    const rl = req.toLowerCase()
    return paths.some((p) => p.toLowerCase() === rl)  // ”some“ 表示如果 paths 中有一个元素满足条件，则返回 true，否则返回 false
  }
  return paths.includes(req)
}
