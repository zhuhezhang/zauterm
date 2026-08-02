//! 凭证命令

use crate::ipc::{ipc_fail_known, ipc_fail_msg, ipc_ok, ipc_ok_empty};
use crate::vault;
use serde_json::{json, Value};
use tauri::{AppHandle, Manager};

/// 凭证是否可用
/// # 返回
/// 一个包含凭证是否可用的 Value
#[tauri::command]
pub fn credentials_is_available() -> Value {
    ipc_ok(json!({ "available": vault::is_encryption_available() }))
}

/// 获取凭证
/// # 参数
/// - app: 应用
/// - saved_id: 保存 ID
/// # 返回
/// 一个包含凭证的 Value
#[tauri::command]
pub fn credentials_get(app: AppHandle, saved_id: String) -> Value {
    let app_data = match app.path().app_data_dir() {
        Ok(p) => p,
        Err(e) => return ipc_fail_msg(e.to_string()),
    };
    ipc_ok(vault::get_secrets(&app_data, &saved_id))
}

/// 同步凭证
/// # 参数
/// - app: 应用
/// - saved_id: 保存 ID
/// - partial: 部分
/// # 返回
/// 一个包含 Result 的同步凭证
#[tauri::command]
pub fn credentials_sync(app: AppHandle, saved_id: String, partial: Value) -> Value {
    let app_data = match app.path().app_data_dir() {
        Ok(p) => p,
        Err(e) => return ipc_fail_msg(e.to_string()),
    };
    match vault::sync_secrets(&app_data, &saved_id, &partial) {
        Ok(()) => ipc_ok_empty(),
        Err(code) if code.starts_with("credentials.") => ipc_fail_known(&code),
        Err(e) => ipc_fail_msg(e),
    }
}

/// 删除凭证
/// # 参数
/// - app: 应用
/// - saved_id: 保存 ID
/// # 返回
/// 一个包含 Result 的删除凭证
#[tauri::command]
pub fn credentials_remove(app: AppHandle, saved_id: String) -> Value {
    let app_data = match app.path().app_data_dir() {
        Ok(p) => p,
        Err(e) => return ipc_fail_msg(e.to_string()),
    };
    match vault::remove_secrets(&app_data, &saved_id) {
        Ok(()) => ipc_ok_empty(),
        Err(e) => ipc_fail_msg(e),
    }
}

/// 复制凭证
/// # 参数
/// - app: 应用
/// - from_id: 从 ID
/// - to_id: 到 ID
/// # 返回
/// 一个包含 Result 的复制凭证
#[tauri::command]
pub fn credentials_duplicate(app: AppHandle, from_id: String, to_id: String) -> Value {
    let app_data = match app.path().app_data_dir() {
        Ok(p) => p,
        Err(e) => return ipc_fail_msg(e.to_string()),
    };
    match vault::duplicate_secrets(&app_data, &from_id, &to_id) {
        Ok(()) => ipc_ok_empty(),
        Err(code) if code.starts_with("credentials.") => ipc_fail_known(&code),
        Err(e) => ipc_fail_msg(e),
    }
}

/// 清除所有凭证
/// # 参数
/// - app: 应用
/// # 返回
/// 一个包含 Result 的清除所有凭证
#[tauri::command]
pub fn credentials_clear_all(app: AppHandle) -> Value {
    let app_data = match app.path().app_data_dir() {
        Ok(p) => p,
        Err(e) => return ipc_fail_msg(e.to_string()),
    };
    match vault::clear_all(&app_data) {
        Ok(()) => ipc_ok_empty(),
        Err(e) => ipc_fail_msg(e),
    }
}
