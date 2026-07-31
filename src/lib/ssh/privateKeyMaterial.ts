/** PEM 私钥内容检测（OpenSSH / PKCS#1 / PKCS#8 等） */
const PEM_PRIVATE_KEY_RE =
  /-----BEGIN (?:OPENSSH |RSA |EC |DSA |ENCRYPTED )?PRIVATE KEY-----/

/**
 * 判断字符串是否为 PEM 私钥内容
 * @param raw 字符串
 * @returns 是否为 PEM 私钥内容
 */
export function isPrivateKeyPemContent(raw: string): boolean {
  return PEM_PRIVATE_KEY_RE.test(String(raw ?? '').trim())
}

/**
 * 判断输入是否像本地私钥文件路径（单行、非 PEM）
 * @param raw 字符串
 * @returns 是否为本地私钥文件路径
 */
export function isPrivateKeyFilePathInput(raw: string): boolean {
  const trimmed = String(raw ?? '').trim()
  if (!trimmed || isPrivateKeyPemContent(trimmed)) return false
  if (/[\r\n]/.test(trimmed)) return false
  return true
}
