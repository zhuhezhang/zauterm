mod commands;
mod dialogs;
mod encoding;
mod ipc;
mod known_hosts;
mod path_policy;
mod serial;
mod session;
mod sftp;
mod ssh;
mod telnet;
mod vault;

use session::AppState;
use std::sync::Arc;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let state = Arc::new(AppState::default());

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            commands::window::window_minimize,
            commands::window::window_maximize,
            commands::window::window_close,
            commands::window::window_set_background_color,
            commands::window::window_is_maximized,
            commands::window::window_zoom_wheel_step,
            commands::app::app_set_ui_language,
            commands::app::app_get_downloads_path,
            commands::app::app_get_version,
            commands::app::app_open_external,
            commands::app::app_choose_open,
            commands::app::app_save_file,
            commands::app::app_validate_log_directory,
            commands::app::app_validate_local_file_path,
            commands::app::app_clear_known_hosts,
            commands::app::app_clear_session_host_key_cache,
            commands::log::log_write,
            commands::log::log_append,
            commands::credentials::credentials_is_available,
            commands::credentials::credentials_get,
            commands::credentials::credentials_sync,
            commands::credentials::credentials_remove,
            commands::credentials::credentials_duplicate,
            commands::credentials::credentials_clear_all,
            commands::ssh::ssh_connect,
            commands::ssh::ssh_disconnect,
            commands::ssh::ssh_send_data,
            commands::ssh::ssh_resize,
            commands::sftp::sftp_connect,
            commands::sftp::sftp_disconnect,
            commands::sftp::sftp_list,
            commands::sftp::sftp_download,
            commands::sftp::sftp_download_dir,
            commands::sftp::sftp_upload,
            commands::sftp::sftp_mkdir,
            commands::sftp::sftp_delete,
            commands::sftp::sftp_rename,
            commands::telnet::telnet_connect,
            commands::telnet::telnet_disconnect,
            commands::telnet::telnet_send_data,
            commands::serial::serial_list_ports,
            commands::serial::serial_connect,
            commands::serial::serial_disconnect,
            commands::serial::serial_send_data,
        ])
        .setup(|app| {
            commands::window::attach_maximize_events(app.handle());
            if let Ok(dir) = app.path().app_data_dir() {
                let _ = std::fs::create_dir_all(&dir);
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
