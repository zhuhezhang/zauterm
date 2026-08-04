import { describe, expect, it } from 'vitest'
import {
  DEFAULT_ALGORITHM_SELECTION,
  SSH_ALGORITHM_OPTION_POOL,
  sanitizeAlgorithmPreferences,
} from '@/lib/ssh/sshAlgorithmDefaults'

describe('sshAlgorithmDefaults (libssh2-aligned)', () => {
  it('option pool excludes algorithms unsupported by libssh2', () => {
    expect(SSH_ALGORITHM_OPTION_POOL.kex).not.toContain('diffie-hellman-group15-sha512')
    expect(SSH_ALGORITHM_OPTION_POOL.kex).not.toContain('diffie-hellman-group17-sha512')
    expect(SSH_ALGORITHM_OPTION_POOL.cipher).not.toContain('aes128-gcm')
    expect(SSH_ALGORITHM_OPTION_POOL.cipher).not.toContain('aes256-gcm')
    expect(SSH_ALGORITHM_OPTION_POOL.hmac).not.toContain('hmac-sha2-256-96')
    expect(SSH_ALGORITHM_OPTION_POOL.hmac).not.toContain('hmac-sha2-512-96')
  })

  it('option pool includes chacha20 and OpenSSH GCM names', () => {
    expect(SSH_ALGORITHM_OPTION_POOL.cipher).toContain('chacha20-poly1305@openssh.com')
    expect(SSH_ALGORITHM_OPTION_POOL.cipher).toContain('aes128-gcm@openssh.com')
    expect(DEFAULT_ALGORITHM_SELECTION.cipher).toContain('chacha20-poly1305@openssh.com')
  })

  it('sanitizeAlgorithmPreferences drops unknown names and falls back when empty', () => {
    const cleaned = sanitizeAlgorithmPreferences({
      kex: ['curve25519-sha256', 'diffie-hellman-group15-sha512'],
      cipher: ['aes128-gcm', 'not-a-real-cipher'],
      hmac: ['hmac-sha2-256-96'],
    })
    expect(cleaned.kex).toEqual(['curve25519-sha256'])
    expect(cleaned.cipher).toEqual([...DEFAULT_ALGORITHM_SELECTION.cipher])
    expect(cleaned.hmac).toEqual([...DEFAULT_ALGORITHM_SELECTION.hmac])
    expect(cleaned.serverHostKey).toEqual([...DEFAULT_ALGORITHM_SELECTION.serverHostKey])
  })

  it('sanitizeAlgorithmPreferences preserves intentional empty lists', () => {
    const cleaned = sanitizeAlgorithmPreferences({
      kex: [],
      serverHostKey: [],
      cipher: [],
      hmac: [],
      compress: [],
    })
    expect(cleaned.kex).toEqual([])
    expect(cleaned.cipher).toEqual([])
    expect(cleaned.hmac).toEqual([])
  })
})
