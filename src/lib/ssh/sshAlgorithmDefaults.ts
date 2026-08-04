/**
 * SSH/SFTP 算法注册表与默认偏好（与本仓库绑定的 libssh2 / ssh2 crate 支持集对齐）
 * 供设置 UI 选项池、弱算法判定、重置默认、连接 payload 使用
 */

/** 单个 SSH 算法定义 */
interface SshAlgorithmDefinition {
  /** 算法标识名（OpenSSH / libssh2 名称） */
  name: string
  /** 是否属于安全算法 */
  safe: boolean
  /** 是否属于默认偏好算法（重置默认时选中） */
  isDefault: boolean
}

/** SSH 算法类别键（kex / cipher 等），与设置 UI 及连接 payload 字段一致 */
export type AlgorithmCategory = 'kex' | 'serverHostKey' | 'cipher' | 'hmac' | 'compress'

/** 按类别索引的算法注册表 */
type SshAlgorithmCatalog = Record<AlgorithmCategory, SshAlgorithmDefinition[]>

/** 用户/连接使用的算法偏好：各类别下已选算法名有序列表 */
export interface AlgorithmPreferences {
  /** 密钥交换算法：用于协商加密密钥 */
  kex: string[]
  /** 服务器主机密钥算法：用于验证服务器身份 */
  serverHostKey: string[]
  /** 对称加密算法：用于加密传输数据 */
  cipher: string[]
  /** 消息认证码算法：用于验证数据完整性 */
  hmac: string[]
  /** 压缩算法：用于压缩传输数据 */
  compress: string[]
}

/** 安全算法 */
const def = (name: string): SshAlgorithmDefinition => ({ name, safe: true, isDefault: true })
/** 遗留算法但保留在默认偏好中（兼容部分老旧服务端） */
const weakDefault = (name: string): SshAlgorithmDefinition => ({ name, safe: false, isDefault: true })
/** 遗留算法，不被默认选中 */
const legacy = (name: string): SshAlgorithmDefinition => ({ name, safe: false, isDefault: false })

/**
 * SSH 算法全集（默认 + 遗留）：仅含 libssh2 可协商名称；
 * 不含 OpenSSH 证书主机密钥、以及 blowfish/arcfour 等极少用的弱 cipher。
 * 遗留项用于兼容老旧服务端；weakDefault 为默认选中但标记为不安全的算法
 */
export const DEFAULT_ALGORITHM_PREFERENCES: SshAlgorithmCatalog = {
  kex: [
    def('curve25519-sha256@libssh.org'),
    def('curve25519-sha256'),
    def('ecdh-sha2-nistp521'),
    def('ecdh-sha2-nistp256'),
    def('ecdh-sha2-nistp384'),
    def('diffie-hellman-group18-sha512'),
    def('diffie-hellman-group16-sha512'),
    def('diffie-hellman-group14-sha256'),
    def('diffie-hellman-group-exchange-sha256'),
    weakDefault('diffie-hellman-group14-sha1'),
    weakDefault('diffie-hellman-group-exchange-sha1'),
    legacy('diffie-hellman-group1-sha1'),
  ],
  serverHostKey: [
    def('ssh-ed25519'),
    def('ecdsa-sha2-nistp256'),
    def('ecdsa-sha2-nistp384'),
    def('ecdsa-sha2-nistp521'),
    def('rsa-sha2-512'),
    def('rsa-sha2-256'),
    weakDefault('ssh-rsa'),
    legacy('ssh-dss'),
  ],
  cipher: [
    def('chacha20-poly1305@openssh.com'),
    def('aes128-gcm@openssh.com'),
    def('aes256-gcm@openssh.com'),
    def('aes128-ctr'),
    def('aes192-ctr'),
    def('aes256-ctr'),
    weakDefault('aes128-cbc'),
    legacy('aes192-cbc'),
    legacy('aes256-cbc'),
    legacy('3des-cbc'),
  ],
  hmac: [
    def('hmac-sha2-256-etm@openssh.com'),
    def('hmac-sha2-512-etm@openssh.com'),
    def('hmac-sha1-etm@openssh.com'),
    def('hmac-sha2-256'),
    def('hmac-sha2-512'),
    weakDefault('hmac-sha1'),
    legacy('hmac-md5'),
    legacy('hmac-ripemd160'),
    legacy('hmac-ripemd160@openssh.com'),
    legacy('hmac-sha1-96'),
    legacy('hmac-md5-96'),
  ],
  compress: [
    def('zlib@openssh.com'),
    def('zlib'),
    def('none'),
  ],
}

/** 默认选中的算法偏好（由注册表中 isDefault 项导出） */
export const DEFAULT_ALGORITHM_SELECTION: AlgorithmPreferences = (() => {
  const out = {} as AlgorithmPreferences
  for (const key of Object.keys(DEFAULT_ALGORITHM_PREFERENCES) as AlgorithmCategory[]) {
    out[key] = DEFAULT_ALGORITHM_PREFERENCES[key].filter((item) => item.isDefault).map((item) => item.name)
  }
  return out
})()

/** 设置页可选算法全集 */
export const SSH_ALGORITHM_OPTION_POOL: Record<AlgorithmCategory, string[]> = (() => {
  const out = {} as Record<AlgorithmCategory, string[]>
  for (const key of Object.keys(DEFAULT_ALGORITHM_PREFERENCES) as AlgorithmCategory[]) {
    out[key] = DEFAULT_ALGORITHM_PREFERENCES[key].map((item) => item.name)
  }
  return out
})()

/**
 * 查找算法定义
 * @param category 算法类别
 * @param name 算法名
 * @returns 算法定义（例如：{ name: 'curve25519-sha256@libssh.org', safe: true, isDefault: true }）
 */
export function findSshAlgorithmDefinition(
  category: AlgorithmCategory,
  name: string,
): SshAlgorithmDefinition | undefined {
  return DEFAULT_ALGORITHM_PREFERENCES[category]?.find((item) => item.name === name)
}

/**
 * 是否属于遗留/较弱算法（用于设置 UI 提示）
 * @param category kex | serverHostKey | cipher | hmac | compress
 * @param name 算法名
 * @returns 是否属于遗留/较弱算法
 */
export function isWeakSshAlgorithm(category: AlgorithmCategory, name: string): boolean {
  const item = findSshAlgorithmDefinition(category, name)
  return item != null && !item.safe
}

/**
 * 过滤算法偏好：去掉不在 libssh2 白名单内的名称。
 * 显式空数组会保留（表示用户清空该类）；仅当原数组非空但全部非法时回退默认。
 * @param prefs 原始偏好（如 localStorage）
 * @returns 与选项池对齐后的偏好
 */
export function sanitizeAlgorithmPreferences(
  prefs: Partial<AlgorithmPreferences> | null | undefined,
): AlgorithmPreferences {
  const out = {} as AlgorithmPreferences
  for (const key of Object.keys(DEFAULT_ALGORITHM_SELECTION) as AlgorithmCategory[]) {
    const raw = prefs?.[key]
    if (!Array.isArray(raw)) {
      out[key] = [...DEFAULT_ALGORITHM_SELECTION[key]]
      continue
    }
    const pool = SSH_ALGORITHM_OPTION_POOL[key]
    const unique = [...new Set(raw.filter((v): v is string => typeof v === 'string' && pool.includes(v)))]
    if (unique.length > 0) {
      out[key] = unique
    } else if (raw.length === 0) {
      out[key] = []
    } else {
      out[key] = [...DEFAULT_ALGORITHM_SELECTION[key]]
    }
  }
  return out
}
