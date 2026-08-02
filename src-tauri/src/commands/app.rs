//! 应用程序命令

use crate::dialogs;
use crate::ipc::{ipc_fail_known, ipc_fail_msg, ipc_ok, ipc_ok_empty};
use crate::known_hosts;
use crate::path_policy::{collect_resolved_roots, validate_local_file_path, validate_log_directory};
use crate::session::AppState;
use serde_json::{json, Value};
use std::sync::Arc;
use tauri::{AppHandle, Manager, State};
use tauri_plugin_opener::OpenerExt;

/// 设置 UI 语言
/// # 参数
/// - state: 状态
/// - ui_language: UI 语言
#[tauri::command]
pub fn app_set_ui_language(state: State<'_, Arc<AppState>>, ui_language: String) {
    *state.ui_language.lock() = ui_language;
}

/// 获取下载路径
/// # 返回
/// 一个包含下载路径的 Value
#[tauri::command]
pub fn app_get_downloads_path() -> Value {
    match dirs::download_dir() {  // 获取下载路径
        Some(p) => ipc_ok(json!({ "path": p.to_string_lossy() })),
        None => match dirs::home_dir() {  // 获取主目录
            Some(h) => ipc_ok(json!({ "path": h.join("Downloads").to_string_lossy() })),
            None => ipc_fail_msg("downloads path unavailable"),  // 下载路径不可用
        },
    }
}

/// 获取版本
/// # 参数
/// - app: 应用
/// # 返回
/// 一个包含版本的 Value
#[tauri::command]
pub fn app_get_version(app: AppHandle) -> Value {
    ipc_ok(json!({ "version": app.package_info().version.to_string() }))
}

/// 打开外部 URL
/// # 参数
/// - app: 应用
/// - url: URL
/// # 返回
/// 一个包含 Result 的打开外部 URL
#[tauri::command]
pub fn app_open_external(app: AppHandle, url: String) -> Value {
    if !(url.starts_with("http://") || url.starts_with("https://")) {
        return ipc_fail_known("app.invalidRequest");
    }
    match app.opener().open_url(url, None::<&str>) {
        Ok(()) => ipc_ok_empty(),
        Err(e) => ipc_fail_msg(e.to_string()),
    }
}

/// 选择打开文件
/// # 参数
/// - app: 应用
/// - kind: 类型
/// # 返回
/// 一个包含 Result 的打开文件
#[tauri::command]
pub async fn app_choose_open(app: AppHandle, kind: String) -> Result<Value, String> {
    Ok(dialogs::choose_open(&app, &kind).await)
}

/// 保存文件
/// # 参数
/// - app: 应用
/// - kind: 类型
/// - default_name: 默认名称
/// - content: 内容
/// # 返回
/// 一个包含 Result 的保存文件
#[tauri::command]
pub async fn app_save_file(app: AppHandle, kind: String, default_name: String, content: String) -> Result<Value, String> {
    Ok(dialogs::save_file(&app, &kind, &default_name, &content).await)
}

/// 验证日志目录
/// # 参数
/// - app: 应用
/// - dir: 目录
/// # 返回
/// 一个包含 Result 的验证日志目录
#[tauri::command]
pub fn app_validate_log_directory(app: AppHandle, dir: String) -> Value {
    let app_data = match app.path().app_data_dir() {
        Ok(p) => p,
        Err(e) => return ipc_fail_msg(e.to_string()),
    };
    let roots = collect_resolved_roots(&app_data);
    match validate_log_directory(&dir, &roots) {
        Ok(()) => ipc_ok_empty(),
        Err(code) => ipc_fail_known(&code),
    }
}

/// 验证本地文件路径
/// # 参数
/// - app: 应用
/// - file_path: 文件路径
/// - kind: 类型
/// # 返回
/// 一个包含 Result 的验证本地文件路径
#[tauri::command]
pub fn app_validate_local_file_path(app: AppHandle, file_path: String, kind: Option<String>) -> Value {
    let app_data = match app.path().app_data_dir() {
        Ok(p) => p,
        Err(e) => return ipc_fail_msg(e.to_string()),
    };
    let roots = collect_resolved_roots(&app_data);
    match validate_local_file_path(&file_path, &roots) {
        Ok(()) => ipc_ok_empty(),
        Err(code) if code == "sftp.pathErrors.localDirDenied" => {
            crate::ipc::ipc_fail_known_params(
                &code,
                json!({ "kind": kind.unwrap_or_else(|| "read".into()) }),
            )
        }
        Err(code) => ipc_fail_known(&code),
    }
}

/// 清除已知主机
/// # 参数
/// - app: 应用
/// # 返回
/// 一个包含 Result 的清除已知主机
#[tauri::command]
pub fn app_clear_known_hosts(app: AppHandle) -> Value {
    let app_data = match app.path().app_data_dir() {
        Ok(p) => p,
        Err(e) => return ipc_fail_msg(e.to_string()),
    };
    match known_hosts::clear_known_hosts(&app_data) {
        Ok(()) => ipc_ok_empty(),
        Err(e) => ipc_fail_msg(e),
    }
}

/// 清除会话主机密钥缓存
/// # 参数
/// - state: 状态
/// # 返回
/// 一个包含 Result 的清除会话主机密钥缓存
#[tauri::command]
pub fn app_clear_session_host_key_cache(state: State<'_, Arc<AppState>>) -> Value {
    known_hosts::clear_session_cache(&state.known_hosts);
    ipc_ok_empty()
}
