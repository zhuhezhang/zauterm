/** Tauri backend bridge implementing window.zterm (ZTermApi) */
import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import type {
  ChooseOpenKind,
  ChooseOpenResult,
  SaveFileKind,
  SerialConnectConfig,
  SshConnectConfig,
  TelnetConnectConfig,
  VaultGetContent,
  VaultSecretPartial,
  ZTermApi,
  ZTermProgress,
  SerialPortInfo,
} from '../../../shared/zterm-api'
import type { SftpEntry } from '../../../shared/others'
import type { IpcResult } from '../../../shared/ipc'

type SessionPayload = [string, string]
type ProgressPayload = [string, ZTermProgress]

function createStreamBridge(prefix: 'ssh' | 'telnet' | 'serial') {
  const outputEvent = `${prefix}:output`
  const closedEvent = `${prefix}:closed`
  return {
    connect: (id: string, config: SshConnectConfig | TelnetConnectConfig | SerialConnectConfig) =>
      invoke<IpcResult>(`${prefix}_connect`, { id, config }),
    disconnect: (id: string) => invoke<IpcResult>(`${prefix}_disconnect`, { id }),
    sendData: (id: string, data: string, encoding?: string) => {
      void invoke(`${prefix}_send_data`, { id, data, encoding: encoding || 'utf-8' })
    },
    onData: (id: string, cb: (data: string) => void) => {
      let unlisten: UnlistenFn | undefined
      void listen<SessionPayload>(outputEvent, (event) => {
        const [sessionId, data] = event.payload
        if (sessionId === id) cb(data)
      }).then((fn) => {
        unlisten = fn
      })
      return () => {
        unlisten?.()
      }
    },
    onClose: (id: string, cb: () => void) => {
      let unlisten: UnlistenFn | undefined
      void listen<string>(closedEvent, (event) => {
        if (event.payload === id) cb()
      }).then((fn) => {
        unlisten = fn
      })
      return () => {
        unlisten?.()
      }
    },
  }
}

export function createTauriZterm(): ZTermApi {
  const sshBase = createStreamBridge('ssh')
  const telnet = createStreamBridge('telnet')
  const serialBase = createStreamBridge('serial')

  return {
    window: {
      minimize: () => {
        void invoke('window_minimize')
      },
      maximize: () => {
        void invoke('window_maximize')
      },
      close: () => {
        void invoke('window_close')
      },
      setBackgroundColor: (hex: string) => {
        void invoke('window_set_background_color', { hex })
      },
      onMaximized: (cb: (v: boolean) => void) => {
        let unlisten: UnlistenFn | undefined
        void listen<boolean>('window:maximized', (event) => cb(event.payload)).then((fn) => {
          unlisten = fn
        })
        return () => unlisten?.()
      },
      isMaximized: () => invoke<IpcResult<{ maximized: boolean }>>('window_is_maximized'),
      zoomWheelStep: (deltaY: number) => {
        void invoke('window_zoom_wheel_step', { deltaY })
      },
    },

    ssh: {
      ...sshBase,
      connect: (id, config) => invoke<IpcResult>('ssh_connect', { id, config }),
      resize: (id, cols, rows) => {
        void invoke('ssh_resize', { id, cols, rows })
      },
    },

    sftp: {
      connect: (id, config) => invoke<IpcResult>('sftp_connect', { id, config }),
      disconnect: (id) => invoke<IpcResult>('sftp_disconnect', { id }),
      list: (id, remotePath) =>
        invoke<IpcResult<{ items: SftpEntry[] }>>('sftp_list', { id, remotePath }),
      download: (id, remotePath, localPath) =>
        invoke<IpcResult>('sftp_download', { id, remotePath, localPath }),
      downloadDir: (id, remoteDir, localDir) =>
        invoke<IpcResult>('sftp_download_dir', { id, remoteDir, localDir }),
      upload: (id, localPath, remotePath) =>
        invoke<IpcResult>('sftp_upload', { id, localPath, remotePath }),
      mkdir: (id, remotePath) => invoke<IpcResult>('sftp_mkdir', { id, remotePath }),
      delete: (id, remotePath) => invoke<IpcResult>('sftp_delete', { id, remotePath }),
      rename: (id, oldPath, newPath) => invoke<IpcResult>('sftp_rename', { id, oldPath, newPath }),
      onProgress: (id, cb) => {
        let unlisten: UnlistenFn | undefined
        void listen<ProgressPayload>('sftp:progress', (event) => {
          const [sessionId, progress] = event.payload
          if (sessionId === id) cb(progress)
        }).then((fn) => {
          unlisten = fn
        })
        return () => unlisten?.()
      },
    },

    telnet: {
      connect: (id, config) => invoke<IpcResult>('telnet_connect', { id, config }),
      disconnect: (id) => invoke<IpcResult>('telnet_disconnect', { id }),
      sendData: telnet.sendData,
      onData: telnet.onData,
      onClose: telnet.onClose,
    },

    serial: {
      listPorts: () => invoke<IpcResult<{ ports: SerialPortInfo[] }>>('serial_list_ports'),
      connect: (id, config) => invoke<IpcResult>('serial_connect', { id, config }),
      disconnect: (id) => invoke<IpcResult>('serial_disconnect', { id }),
      sendData: serialBase.sendData,
      onData: serialBase.onData,
      onClose: serialBase.onClose,
    },

    credentials: {
      isAvailable: () => invoke<IpcResult<{ available: boolean }>>('credentials_is_available'),
      get: (savedId) => invoke<IpcResult<VaultGetContent>>('credentials_get', { savedId }),
      sync: (savedId, partial: VaultSecretPartial) =>
        invoke<IpcResult>('credentials_sync', { savedId, partial }),
      remove: (savedId) => invoke<IpcResult>('credentials_remove', { savedId }),
      duplicate: (fromId, toId) => invoke<IpcResult>('credentials_duplicate', { fromId, toId }),
      clearAll: () => invoke<IpcResult>('credentials_clear_all'),
    },

    paths: {
      getDownloadsPath: () => invoke<IpcResult<{ path: string }>>('app_get_downloads_path'),
      chooseOpen: (kind: ChooseOpenKind) =>
        invoke<IpcResult<ChooseOpenResult>>('app_choose_open', { kind }),
      validateLogDirectory: (dir) => invoke<IpcResult>('app_validate_log_directory', { dir }),
      validateLocalFilePath: (filePath, kind) =>
        invoke<IpcResult>('app_validate_local_file_path', { filePath, kind }),
      getPathForFile: (file: File) => {
        // Tauri: File from drag-drop may expose path via webkitRelativePath; prefer dialog APIs
        const anyFile = file as File & { path?: string }
        return typeof anyFile.path === 'string' ? anyFile.path : ''
      },
    },

    save: {
      saveFile: (kind: SaveFileKind, defaultName: string, content: string) =>
        invoke<IpcResult<{ canceled?: boolean }>>('app_save_file', { kind, defaultName, content }),
    },

    log: {
      write: (logDir, sessionId, data) => {
        void invoke('log_write', { logDir, sessionId, data })
      },
      append: (logDir, sessionId, data) => {
        void invoke('log_append', { logDir, sessionId, data })
      },
    },

    others: {
      setUiLanguage: (uiLanguage) => {
        void invoke('app_set_ui_language', { uiLanguage })
      },
      getVersion: () => invoke<IpcResult<{ version: string }>>('app_get_version'),
      openExternal: (url) => invoke<IpcResult>('app_open_external', { url }),
      clearKnownHosts: () => invoke<IpcResult>('app_clear_known_hosts'),
      clearSessionHostKeyCache: () => invoke<IpcResult>('app_clear_session_host_key_cache'),
    },
  }
}
