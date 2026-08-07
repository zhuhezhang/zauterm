//! Zauterm 主库，包含所有功能模块和命令

// 抑制链接警告 LNK4099：Windows 上 vendored OpenSSL 静态链接常缺 ossl_static.pdb，MSVC LNK4099 经 rustc 变成 linker_messages 警告
#![cfg_attr(windows, allow(linker_messages))]

mod commands;  // Rust 的模块声明: 告诉编译器「crate 里有这些子模块」，并把它们挂到 lib.rs 这个库根上
mod dialogs;
mod encoding;
mod invoke_commands;
mod ipc;
mod known_hosts;
mod local;
mod path_policy;
mod serial;
mod session;
mod sftp;
mod ssh;
mod ssh_key;
mod telnet;
mod traffic_lights;
mod vault;

use session::AppState;
use std::sync::Arc;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]  // 移动端的系统启动方式不同，不能靠普通 main；Tauri 需要这个宏把 run 接成正确的移动入口
pub fn run() {
    let state = Arc::new(AppState::default());

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init()) // 加载对话框插件（系统确认框/消息框）
        .plugin(tauri_plugin_opener::init()) // 加载打开器插件（用系统浏览器打开 URL）
        .plugin(tauri_plugin_clipboard_manager::init()) // 系统剪贴板（选中复制 / 右键粘贴）
        .manage(state) // 管理应用状态（全局状态）
        // 命令名称必须与 `invoke_commands::REGISTERED_INVOKE_COMMANDS` 和 `src-isolation/index.js` 保持同步
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
            commands::sftp::sftp_upload_bytes,
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
            commands::local::local_connect,
            commands::local::local_disconnect,
            commands::local::local_send_data,
            commands::local::local_resize,
        ])
        .setup(|app| { // 初始化设置应用（初始化窗口、创建数据目录等）
            commands::window::attach_maximize_events(app.handle()); // 监听窗口最大化事件
            if let Ok(dir) = app.path().app_data_dir() { // 获取应用数据目录，获取不到则跳过
                let _ = std::fs::create_dir_all(&dir);  // 创建应用数据目录
            }
            if let Some(win) = app.get_webview_window("main") {  // 获取主窗口，用于调整macOS 红绿灯位置
                traffic_lights::center_traffic_lights(&win);  // 第一次居中红绿灯位置
                let win2 = win.clone();
                std::thread::spawn(move || {
                    std::thread::sleep(std::time::Duration::from_millis(120));  // 120ms后再次居中红绿灯位置（系统有时会稍后重排原生控件，延迟后再纠正，避免“闪一下又错位”）
                    let win3 = win2.clone();
                    let _ = win2.run_on_main_thread(move || {  // 在主线程上执行，避免在异步线程上执行导致UI不响应
                        traffic_lights::center_traffic_lights(&win3);
                    });
                });
            }
            Ok(())  // setup 返回 Ok(()) 表示初始化成功，否则会返回 Err(String) 表示初始化失败
        })
        .run(tauri::generate_context!())  // 创建窗口、进入事件循环，一直阻塞到应用退出
        .expect("error while running tauri application");  // 如果运行失败，则打印错误信息
}
