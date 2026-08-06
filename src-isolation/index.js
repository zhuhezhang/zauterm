/**
 * src-isolation与src-tauri/capabilities/default.json都是安全闸门，但卡的位置不同。
 * src-isolation：在 Tauri Core 处理之前拦截 IPC 请求，即IPC 入口「允许哪些命令名通过」
 * src-tauri/capabilities/default.json：在 Tauri Core 处理之后拦截 IPC 请求，即 Rust/Tauri 侧「窗口能做什么」
 * 自定义业务命令（SSH/SFTP 等）主要靠 isolation + generate_handler!；窗口/dialog 这类插件能力两边都要：capabilities 授权，isolation 再限制实际会调用的那几条。
 * 
 * 插件：指的是 Tauri 官方/社区提供的扩展包：给应用加一套现成能力（对话框、开外链、文件系统等），而不是自己写的 ssh_connect 那种业务命令
 * 
 * 有效载荷形状：{ cmd, callback, error, options, payload }
 * 
 * App 命令列表必须与 src-tauri/src/invoke_commands.rs (REGISTERED_INVOKE_COMMANDS) 和 lib.rs generate_handler! 中注册的命令匹配。
 */

/** App 命令列表，注册在 src-tauri/src/lib.rs (generate_handler!) */
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
  local_connect: 1,
  local_disconnect: 1,
  local_send_data: 1,
  local_resize: 1,
}

/** 收紧插件 IPC 允许列表(前端实际上使用这些)，必须与 invoke_commands::ALLOWED_PLUGIN_COMMANDS 匹配 */
var ALLOWED_PLUGIN_CMDS = {
  'plugin:dialog|message': 1,
  'plugin:event|listen': 1,
  'plugin:event|unlisten': 1,
  'plugin:window|start_dragging': 1,
  'plugin:webview|set_webview_zoom': 1,
  'plugin:clipboard-manager|read_text': 1,
  'plugin:clipboard-manager|write_text': 1,
}

/**
 * 检查 URL 是否安全
 * @param {string} url 要检查的 URL
 * @returns {boolean} 是否安全
 */
function isSafeExternalUrl(url) {
  return typeof url === 'string' && (url.indexOf('https://') === 0 || url.indexOf('http://') === 0)
}

/**
 * 隔离钩子函数
 * @param {object} payload 有效载荷
 * @returns {object} 有效载荷，如果安全则返回，否则抛出错误
 */
window.__TAURI_ISOLATION_HOOK__ = function (payload) {
  if (!payload || typeof payload !== 'object') {  // 若有效载荷不存在或不是对象，则抛出错误
    throw new Error('isolation: invalid payload')
  }

  var cmd = payload.cmd
  if (typeof cmd !== 'string') {  // 若命令不是字符串，则抛出错误
    throw new Error('isolation: missing cmd')
  }

  var allowed = ALLOWED_CMDS[cmd] === 1 || ALLOWED_PLUGIN_CMDS[cmd] === 1
  if (!allowed) {  // 若命令不在允许列表中，则抛出错误
    throw new Error('isolation: blocked cmd ' + cmd)
  }

  if (cmd === 'app_open_external') {  // 若命令是 app_open_external，则检查 URL 是否安全
    var args = payload.payload
    var url = args && typeof args === 'object' ? args.url : null
    if (!isSafeExternalUrl(url)) {
      throw new Error('isolation: blocked open_external url')
    }
  }

  return payload
}
