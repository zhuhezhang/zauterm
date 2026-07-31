//! Open/save dialog scenarios

use crate::ipc::{ipc_fail_known, ipc_fail_known_params, ipc_fail_msg, ipc_ok};
use crate::path_policy::{assert_path_allowed, collect_resolved_roots};
use serde_json::{json, Value};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};
use tauri_plugin_dialog::DialogExt;
use walkdir::WalkDir;

fn path_to_string(p: tauri_plugin_dialog::FilePath) -> Option<String> {
    p.into_path().ok().map(|x| x.to_string_lossy().to_string())
}

fn path_denied(kind: &str) -> Value {
    ipc_fail_known_params(
        "sftp.pathErrors.localDirDenied",
        json!({ "kind": kind }),
    )
}

pub async fn choose_open(app: &AppHandle, kind: &str) -> Value {
    let app_data = match app.path().app_data_dir() {
        Ok(p) => p,
        Err(e) => return ipc_fail_msg(e.to_string()),
    };
    let roots = collect_resolved_roots(&app_data);

    match kind {
        "logSave" | "sftpDownload" => {
            let path_kind = if kind == "logSave" { "export" } else { "download" };
            let path = blocking_pick_folder(app).await;
            match path {
                None => ipc_ok(json!({ "canceled": true })),
                Some(p) => {
                    if assert_path_allowed(Path::new(&p), &roots).is_err() {
                        return path_denied(path_kind);
                    }
                    ipc_ok(json!({ "path": p }))
                }
            }
        }
        "sftpUploadFiles" => {
            let paths = blocking_pick_files(app).await;
            match paths {
                None => ipc_ok(json!({ "canceled": true })),
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
        "sftpUploadFolder" => {
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
        "importSessions" | "importSettings" | "privateKey" => {
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

pub async fn save_file(app: &AppHandle, kind: &str, default_name: &str, content: &str) -> Value {
    let app_data = match app.path().app_data_dir() {
        Ok(p) => p,
        Err(e) => return ipc_fail_msg(e.to_string()),
    };
    let roots = collect_resolved_roots(&app_data);
    let path_kind = match kind {
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

async fn blocking_pick_folder(app: &AppHandle) -> Option<String> {
    let app = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        app.dialog().file().blocking_pick_folder().and_then(path_to_string)
    })
    .await
    .ok()
    .flatten()
}

async fn blocking_pick_file(app: &AppHandle) -> Option<String> {
    let app = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        app.dialog().file().blocking_pick_file().and_then(path_to_string)
    })
    .await
    .ok()
    .flatten()
}

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
