use crate::dialogs;
use crate::ipc::{ipc_fail_known, ipc_fail_msg, ipc_ok, ipc_ok_empty};
use crate::known_hosts;
use crate::path_policy::{collect_resolved_roots, validate_local_file_path, validate_log_directory};
use crate::session::AppState;
use serde_json::{json, Value};
use std::sync::Arc;
use tauri::{AppHandle, Manager, State};
use tauri_plugin_opener::OpenerExt;

#[tauri::command]
pub fn app_set_ui_language(state: State<'_, Arc<AppState>>, ui_language: String) {
    *state.ui_language.lock() = ui_language;
}

#[tauri::command]
pub fn app_get_downloads_path() -> Value {
    match dirs::download_dir() {
        Some(p) => ipc_ok(json!({ "path": p.to_string_lossy() })),
        None => match dirs::home_dir() {
            Some(h) => ipc_ok(json!({ "path": h.join("Downloads").to_string_lossy() })),
            None => ipc_fail_msg("downloads path unavailable"),
        },
    }
}

#[tauri::command]
pub fn app_get_version(app: AppHandle) -> Value {
    ipc_ok(json!({ "version": app.package_info().version.to_string() }))
}

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

#[tauri::command]
pub async fn app_choose_open(app: AppHandle, kind: String) -> Result<Value, String> {
    Ok(dialogs::choose_open(&app, &kind).await)
}

#[tauri::command]
pub async fn app_save_file(app: AppHandle, kind: String, default_name: String, content: String) -> Result<Value, String> {
    Ok(dialogs::save_file(&app, &kind, &default_name, &content).await)
}

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

#[tauri::command]
pub fn app_clear_session_host_key_cache(state: State<'_, Arc<AppState>>) -> Value {
    known_hosts::clear_session_cache(&state.known_hosts);
    ipc_ok_empty()
}
