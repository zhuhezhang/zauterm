import type {
  SerialConnectConfig, SshConnectConfig, TelnetConnectConfig,
} from '../../../shared/zterm-api'
import type { AppSettings } from '../../types/settings'
import type { ActiveSshSession, ActiveTelnetSession, ActiveSerialSession } from '../../types/session'

/**
 * 提取 SSH / SFTP 连接所需字段
 * @param session 会话
 * @param sshSettings  SSH 设置
 * @returns 返回 SSH / SFTP 连接配置
 */
export function pickSshConnectConfig(
  session: ActiveSshSession,
  sshSettings?: Pick<AppSettings, 'algorithmPreferences' | 'sshKeepaliveInterval'>,
): SshConnectConfig { 
  return {
    host: session.host,
    port: session.port,
    username: session.username,
    authType: session.authType,
    password: session.password,
    privateKey: session.privateKey,
    passphrase: session.passphrase,
    enableSftp: session.enableSftp,
    encoding: session.encoding,
    backspaceMode: session.backspaceMode,
    algorithms: sshSettings?.algorithmPreferences,
    sshKeepaliveInterval: sshSettings?.sshKeepaliveInterval,
  }
}

/**
 * 提取 Telnet 连接所需字段
 * @param session 会话
 * @returns 返回 Telnet 连接配置
 */
export function pickTelnetConnectConfig(session: ActiveTelnetSession): TelnetConnectConfig {
  return {
    host: session.host,
    port: session.port,
    encoding: session.encoding,
    backspaceMode: session.backspaceMode,
  }
}

/**
 * 提取 Serial 连接所需字段
 * @param session 会话
 * @returns 返回 Serial 连接配置
 */
export function pickSerialConnectConfig(session: ActiveSerialSession): SerialConnectConfig {
  return {
    path: session.path,
    baudRate: session.baudRate,
    dataBits: session.dataBits,
    stopBits: session.stopBits,
    parity: session.parity,
    encoding: session.encoding,
    backspaceMode: session.backspaceMode,
  }
}
