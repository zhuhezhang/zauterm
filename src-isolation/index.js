/**
 * Isolation hook: intercept IPC before Tauri Core.
 * Keep dependencies at zero (plain script only; no bundler/ESM).
 *
 * Payload shape: { cmd, callback, error, options, payload }
 */

/** App invoke commands registered in src-tauri/src/lib.rs */
var ALLOWED_CMDS = {
  window_minimize: 1,
  window_maximize: 1,
  window_close: 1,
  window_set_background_color: 1,
  window_is_maximized: 1,
  window_zoom_wheel_step: 1,
  app_set_ui_language: 1,
  app_get_downloads_path: 1,
  app_get_version: 1,
  app_open_external: 1,
  app_choose_open: 1,
  app_save_file: 1,
  app_validate_log_directory: 1,
  app_validate_local_file_path: 1,
  app_clear_known_hosts: 1,
  app_clear_session_host_key_cache: 1,
  log_write: 1,
  log_append: 1,
  credentials_is_available: 1,
  credentials_get: 1,
  credentials_sync: 1,
  credentials_remove: 1,
  credentials_duplicate: 1,
  credentials_clear_all: 1,
  ssh_connect: 1,
  ssh_disconnect: 1,
  ssh_send_data: 1,
  ssh_resize: 1,
  sftp_connect: 1,
  sftp_disconnect: 1,
  sftp_list: 1,
  sftp_download: 1,
  sftp_download_dir: 1,
  sftp_upload: 1,
  sftp_upload_bytes: 1,
  sftp_mkdir: 1,
  sftp_delete: 1,
  sftp_rename: 1,
  telnet_connect: 1,
  telnet_disconnect: 1,
  telnet_send_data: 1,
  serial_list_ports: 1,
  serial_connect: 1,
  serial_disconnect: 1,
  serial_send_data: 1,
}

/**
 * Plugin IPC uses cmds like `plugin:dialog|open`.
 * @param {string} cmd
 */
function isAllowedPluginCmd(cmd) {
  return cmd.indexOf('plugin:') === 0
}

/**
 * @param {string} url
 */
function isSafeExternalUrl(url) {
  return typeof url === 'string' && (url.indexOf('https://') === 0 || url.indexOf('http://') === 0)
}

window.__TAURI_ISOLATION_HOOK__ = function (payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('isolation: invalid payload')
  }

  var cmd = payload.cmd
  if (typeof cmd !== 'string') {
    throw new Error('isolation: missing cmd')
  }

  var allowed = ALLOWED_CMDS[cmd] === 1 || isAllowedPluginCmd(cmd)
  if (!allowed) {
    throw new Error('isolation: blocked cmd ' + cmd)
  }

  if (cmd === 'app_open_external') {
    var args = payload.payload
    var url = args && typeof args === 'object' ? args.url : null
    if (!isSafeExternalUrl(url)) {
      throw new Error('isolation: blocked open_external url')
    }
  }

  return payload
}
