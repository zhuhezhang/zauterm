use crate::ipc::{ipc_fail_known, ipc_fail_msg, ipc_ok, ipc_ok_empty};
use crate::session::sftp::SftpCmd;
use crate::session::AppState;
use crate::sftp;
use crate::ssh::SshConnectConfig;
use serde_json::Value;
use std::sync::Arc;
use tauri::{AppHandle, State};

#[tauri::command]
pub async fn sftp_connect(
    app: AppHandle,
    state: State<'_, Arc<AppState>>,
    id: String,
    config: Value,
) -> Result<Value, String> {
    let cfg = SshConnectConfig::from_value(&config);
    Ok(match sftp::connect(app, state.inner().clone(), id, cfg).await {
        Ok(()) => ipc_ok_empty(),
        Err(code) if code.contains('.') => ipc_fail_known(&code),
        Err(e) => ipc_fail_msg(e),
    })
}

#[tauri::command]
pub fn sftp_disconnect(state: State<'_, Arc<AppState>>, id: String) -> Value {
    sftp::disconnect(&state, &id);
    ipc_ok_empty()
}

#[tauri::command]
pub async fn sftp_list(state: State<'_, Arc<AppState>>, id: String, remote_path: String) -> Result<Value, String> {
    Ok(match sftp::request(&state, &id, |reply| SftpCmd::List { remote_path, reply }).await {
        Ok(v) => ipc_ok(v),
        Err(code) if code.contains('.') => ipc_fail_known(&code),
        Err(e) => ipc_fail_msg(e),
    })
}

#[tauri::command]
pub async fn sftp_download(
    state: State<'_, Arc<AppState>>,
    id: String,
    remote_path: String,
    local_path: String,
) -> Result<Value, String> {
    Ok(match sftp::request(&state, &id, |reply| SftpCmd::Download {
        remote_path,
        local_path,
        reply,
    })
    .await
    {
        Ok(()) => ipc_ok_empty(),
        Err(code) if code.contains('.') => ipc_fail_known(&code),
        Err(e) => ipc_fail_msg(e),
    })
}

#[tauri::command]
pub async fn sftp_download_dir(
    state: State<'_, Arc<AppState>>,
    id: String,
    remote_dir: String,
    local_dir: String,
) -> Result<Value, String> {
    Ok(match sftp::request(&state, &id, |reply| SftpCmd::DownloadDir {
        remote_dir,
        local_dir,
        reply,
    })
    .await
    {
        Ok(()) => ipc_ok_empty(),
        Err(code) if code.contains('.') => ipc_fail_known(&code),
        Err(e) => ipc_fail_msg(e),
    })
}

#[tauri::command]
pub async fn sftp_upload(
    state: State<'_, Arc<AppState>>,
    id: String,
    local_path: String,
    remote_path: String,
) -> Result<Value, String> {
    Ok(match sftp::request(&state, &id, |reply| SftpCmd::Upload {
        local_path,
        remote_path,
        reply,
    })
    .await
    {
        Ok(()) => ipc_ok_empty(),
        Err(code) if code.contains('.') => ipc_fail_known(&code),
        Err(e) => ipc_fail_msg(e),
    })
}

#[tauri::command]
pub async fn sftp_mkdir(state: State<'_, Arc<AppState>>, id: String, remote_path: String) -> Result<Value, String> {
    Ok(match sftp::request(&state, &id, |reply| SftpCmd::Mkdir { remote_path, reply }).await {
        Ok(()) => ipc_ok_empty(),
        Err(e) => ipc_fail_msg(e),
    })
}

#[tauri::command]
pub async fn sftp_delete(state: State<'_, Arc<AppState>>, id: String, remote_path: String) -> Result<Value, String> {
    Ok(match sftp::request(&state, &id, |reply| SftpCmd::Delete { remote_path, reply }).await {
        Ok(()) => ipc_ok_empty(),
        Err(e) => ipc_fail_msg(e),
    })
}

#[tauri::command]
pub async fn sftp_rename(
    state: State<'_, Arc<AppState>>,
    id: String,
    old_path: String,
    new_path: String,
) -> Result<Value, String> {
    Ok(match sftp::request(&state, &id, |reply| SftpCmd::Rename {
        old_path,
        new_path,
        reply,
    })
    .await
    {
        Ok(()) => ipc_ok_empty(),
        Err(e) => ipc_fail_msg(e),
    })
}
