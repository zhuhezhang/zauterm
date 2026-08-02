//! 打开/保存对话框场景

use crate::ipc::{ipc_fail_known, ipc_fail_known_params, ipc_fail_msg, ipc_ok};
use crate::path_policy::{assert_path_allowed, collect_resolved_roots};
use serde_json::{json, Value};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};
use tauri_plugin_dialog::DialogExt;
use walkdir::WalkDir;

/// 路径转换为字符串
/// # 参数
/// - p: 路径
/// # 返回
/// 一个包含 String 的路径，如果成功则返回 Ok(String)，否则返回 None
fn path_to_string(p: tauri_plugin_dialog::FilePath) -> Option<String> {
    p.into_path().ok().map(|x| x.to_string_lossy().to_string())
}

/// 路径拒绝
/// # 参数
/// - kind: 路径类型
/// # 返回
/// 一个包含 Value 的错误结果，如果成功则返回 Ok(Value)，否则返回 Err(String)
fn path_denied(kind: &str) -> Value {
    ipc_fail_known_params(
        "sftp.pathErrors.localDirDenied",
        json!({ "kind": kind }),
    )
}

/// 选择打开
/// # 参数
/// - app: 应用程序句柄
/// - kind: 路径类型
/// # 返回
/// 一个包含 Value 的值，如果成功则返回 Ok(Value)，否则返回 Err(String)
pub async fn choose_open(app: &AppHandle, kind: &str) -> Value {
    let app_data = match app.path().app_data_dir() {
        Ok(p) => p,
        Err(e) => return ipc_fail_msg(e.to_string()),
    };
    let roots = collect_resolved_roots(&app_data);

    match kind { // 匹配路径类型
        "logSave" | "sftpDownload" => { // 匹配日志保存或SFTP下载
            let path_kind = if kind == "logSave" { "export" } else { "download" };
            let path = blocking_pick_folder(app).await; // 选择文件夹
            match path {
                None => ipc_ok(json!({ "canceled": true })), // 取消
                Some(p) => {
                    if assert_path_allowed(Path::new(&p), &roots).is_err() {
                        return path_denied(path_kind); // 路径拒绝
                    }
                    ipc_ok(json!({ "path": p }))
                }
            }
        }
        "sftpUploadFiles" => {  // 匹配SFTP上传文件
            let paths = blocking_pick_files(app).await;
            match paths {
                None => ipc_ok(json!({ "canceled": true })), // 取消
                Some(ps) => {
                    for p in &ps {
                        if assert_path_allowed(Path::new(p), &roots).is_err() {
                            return path_denied("upload");
                        }
                    }
                    ipc_ok(json!({ "paths": ps }))
                }
            }
        }
        "sftpUploadFolder" => {  // 匹配SFTP上传文件夹
            let path = blocking_pick_folder(app).await;
            match path {
                None => ipc_ok(json!({ "canceled": true })),
                Some(dir) => {
                    if assert_path_allowed(Path::new(&dir), &roots).is_err() {
                        return path_denied("upload");
                    }
                    let base = PathBuf::from(&dir);
                    // Match drag-drop collectEntryNodes: keep the selected folder name
                    // so remote gets `<folder>/...` instead of flattening files into cwd.
                    let folder_name = base
                        .file_name()
                        .map(|s| s.to_string_lossy().to_string())
                        .filter(|s| !s.is_empty())
                        .unwrap_or_else(|| "folder".to_string());
                    let mut entries = Vec::new();
                    for e in WalkDir::new(&base).into_iter().filter_map(|e| e.ok()) {
                        if !e.file_type().is_file() {
                            continue;
                        }
                        let full = e.path().to_string_lossy().to_string();
                        let rel_inner = e
                            .path()
                            .strip_prefix(&base)
                            .unwrap_or(e.path())
                            .to_string_lossy()
                            .replace('\\', "/");
                        let rel = if rel_inner.is_empty() {
                            folder_name.clone()
                        } else {
                            format!("{folder_name}/{rel_inner}")
                        };
                        entries.push(json!({ "path": full, "relativePath": rel }));
                    }
                    if entries.is_empty() {
                        return ipc_ok(json!({ "canceled": true }));
                    }
                    ipc_ok(json!({ "entries": entries }))
                }
            }
        }
        "importSessions" | "importSettings" | "privateKey" => {  // 匹配导入会话或设置或私钥
            let path_kind = if kind == "privateKey" { "read" } else { "import" };
            let path = blocking_pick_file(app).await;
            match path {
                None => ipc_ok(json!({ "canceled": true })),
                Some(p) => {
                    if assert_path_allowed(Path::new(&p), &roots).is_err() {
                        return path_denied(path_kind);
                    }
                    match fs::read_to_string(&p) {
                        Ok(content) => ipc_ok(json!({ "content": content })),
                        Err(e) => ipc_fail_msg(e.to_string()),
                    }
                }
            }
        }
        _ => ipc_fail_known("app.invalidRequest"),
    }
}

/// 保存文件
/// # 参数
/// - app: 应用程序句柄
/// - kind: 路径类型
/// - default_name: 默认名称
/// - content: 内容
/// # 返回
/// 一个包含 Value 的值，如果成功则返回 Ok(Value)，否则返回 Err(String)
pub async fn save_file(app: &AppHandle, kind: &str, default_name: &str, content: &str) -> Value {
    let app_data = match app.path().app_data_dir() { // 获取应用程序数据目录
        Ok(p) => p,
        Err(e) => return ipc_fail_msg(e.to_string()),
    };
    let roots = collect_resolved_roots(&app_data); // 收集解析的根路径
    let path_kind = match kind { // 匹配路径类型
        "terminalOutput" => "saveOutput",
        "sessions" | "settings" => "export",
        _ => "export",
    };
    let path = blocking_save_file(app, default_name, kind).await;
    match path {
        None => ipc_ok(json!({ "canceled": true })),
        Some(p) => {
            if assert_path_allowed(Path::new(&p), &roots).is_err() {
                return path_denied(path_kind);
            }
            match fs::write(&p, content) {
                Ok(()) => ipc_ok(json!({})),
                Err(e) => ipc_fail_msg(e.to_string()),
            }
        }
    }
}

/// 阻塞选择文件夹
/// # 参数
/// - app: 应用程序句柄
/// # 返回
/// 一个包含 Option<String> 的文件夹路径，如果成功则返回 Ok(Option<String>)，否则返回 Err(String)
async fn blocking_pick_folder(app: &AppHandle) -> Option<String> {
    let app = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        app.dialog().file().blocking_pick_folder().and_then(path_to_string)
    })
    .await
    .ok()
    .flatten()
}

/// 阻塞选择文件
/// # 参数
/// - app: 应用程序句柄
/// # 返回
/// 一个包含 Option<String> 的文件路径，如果成功则返回 Ok(Option<String>)，否则返回 Err(String)
async fn blocking_pick_file(app: &AppHandle) -> Option<String> {
    let app = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        app.dialog().file().blocking_pick_file().and_then(path_to_string)
    })
    .await
    .ok()
    .flatten()
}

/// 阻塞选择多个文件
/// # 参数
/// - app: 应用程序句柄
/// # 返回
/// 一个包含 Option<Vec<String>> 的文件路径列表，如果成功则返回 Ok(Option<Vec<String>>)，否则返回 Err(String)
async fn blocking_pick_files(app: &AppHandle) -> Option<Vec<String>> {
    let app = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        app.dialog().file().blocking_pick_files().map(|ps| {
            ps.into_iter().filter_map(path_to_string).collect::<Vec<_>>()
        })
    })
    .await
    .ok()
    .flatten()
}

/// 阻塞保存文件
/// # 参数
/// - app: 应用程序句柄
/// - default_name: 默认名称
/// - kind: 路径类型
/// # 返回
/// 一个包含 Option<String> 的文件路径，如果成功则返回 Ok(Option<String>)，否则返回 Err(String)
async fn blocking_save_file(app: &AppHandle, default_name: &str, kind: &str) -> Option<String> {
    let app = app.clone();
    let default_name = default_name.to_string();
    let filter = match kind {
        "sessions" | "settings" => ("JSON", vec!["json"]),
        _ => ("Log / Text", vec!["log", "txt", "text"]),
    };
    tauri::async_runtime::spawn_blocking(move || {
        app.dialog()
            .file()
            .set_file_name(&default_name)
            .add_filter(filter.0, &filter.1)
            .blocking_save_file()
            .and_then(path_to_string)
    })
    .await
    .ok()
    .flatten()
}
