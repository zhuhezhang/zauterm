import { describe, expect, it } from 'vitest'
import {
  isPrivateKeyFilePathInput,
  isPrivateKeyPemContent,
} from '../../shared/privateKeyMaterial'

const SAMPLE_PEM = `-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW
-----END OPENSSH PRIVATE KEY-----`

describe('privateKeyMaterial', () => {
  it('detects PEM content', () => {
    expect(isPrivateKeyPemContent(SAMPLE_PEM)).toBe(true)
    expect(isPrivateKeyPemContent('-----BEGIN RSA PRIVATE KEY-----\nabc')).toBe(true)
  })

  it('rejects non-PEM strings', () => {
    expect(isPrivateKeyPemContent('/Users/me/.ssh/id_rsa')).toBe(false)
    expect(isPrivateKeyPemContent('')).toBe(false)
  })

  it('detects file path input', () => {
    expect(isPrivateKeyFilePathInput('/Users/me/.ssh/id_rsa')).toBe(true)
    expect(isPrivateKeyFilePathInput('~/.ssh/id_rsa')).toBe(true)
    expect(isPrivateKeyFilePathInput(SAMPLE_PEM)).toBe(false)
    expect(isPrivateKeyFilePathInput('line1\nline2')).toBe(false)
  })
})
