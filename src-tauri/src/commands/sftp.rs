//! SFTP 命令

use crate::ipc::{ipc_fail_known, ipc_fail_msg, ipc_ok, ipc_ok_empty};
use crate::session::sftp::SftpCmd;
use crate::session::AppState;
use crate::sftp;
use crate::ssh::SshConnectConfig;
use serde_json::Value;
use std::sync::Arc;
use tauri::{AppHandle, State};

/// 连接 SFTP
/// # 参数
/// - app: 应用
/// - state: 状态
/// - id: 会话 ID
/// - config: 配置
/// # 返回
/// 一个包含 Result 的连接 SFTP
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

/// 断开 SFTP
/// # 参数
/// - state: 状态
/// - id: 会话 ID
/// # 返回
/// 一个包含 Result 的断开 SFTP
#[tauri::command]
pub fn sftp_disconnect(state: State<'_, Arc<AppState>>, id: String) -> Value {
    sftp::disconnect(&state, &id);
    ipc_ok_empty()
}

/// 列出 SFTP
/// # 参数
/// - state: 状态
/// - id: 会话 ID
/// - remote_path: 远程路径
/// # 返回
/// 一个包含 Result 的列出 SFTP
#[tauri::command]
pub async fn sftp_list(state: State<'_, Arc<AppState>>, id: String, remote_path: String) -> Result<Value, String> {
    Ok(match sftp::request(&state, &id, |reply| SftpCmd::List { remote_path, reply }).await {
        Ok(v) => ipc_ok(v),
        Err(code) if code.contains('.') => ipc_fail_known(&code),
        Err(e) => ipc_fail_msg(e),
    })
}

/// 下载 SFTP
/// # 参数
/// - state: 状态
/// - id: 会话 ID
/// - remote_path: 远程路径
/// - local_path: 本地路径
/// # 返回
/// 一个包含 Result 的下载 SFTP
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

/// 下载目录 SFTP
/// # 参数
/// - state: 状态
/// - id: 会话 ID
/// - remote_dir: 远程目录
/// - local_dir: 本地目录
/// # 返回
/// 一个包含 Result 的下载目录 SFTP
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

/// 上传 SFTP
/// # 参数
/// - state: 状态
/// - id: 会话 ID
/// - local_path: 本地路径
/// - remote_path: 远程路径
/// # 返回
/// 一个包含 Result 的上传 SFTP
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

/// 上传字节 SFTP
/// # 参数
/// - state: 状态
/// - id: 会话 ID
/// - remote_path: 远程路径
/// - data: 数据
/// # 返回
/// 一个包含 Result 的上传字节 SFTP
#[tauri::command]
pub async fn sftp_upload_bytes(
    state: State<'_, Arc<AppState>>,
    id: String,
    remote_path: String,
    data: Vec<u8>,
) -> Result<Value, String> {
    Ok(match sftp::request(&state, &id, |reply| SftpCmd::UploadBytes {
        remote_path,
        data,
        reply,
    })
    .await
    {
        Ok(()) => ipc_ok_empty(),
        Err(code) if code.contains('.') => ipc_fail_known(&code),
        Err(e) => ipc_fail_msg(e),
    })
}

/// 创建目录 SFTP
/// # 参数
/// - state: 状态
/// - id: 会话 ID
/// - remote_path: 远程路径
/// # 返回
/// 一个包含 Result 的创建目录 SFTP
#[tauri::command]
pub async fn sftp_mkdir(state: State<'_, Arc<AppState>>, id: String, remote_path: String) -> Result<Value, String> {
    Ok(match sftp::request(&state, &id, |reply| SftpCmd::Mkdir { remote_path, reply }).await {
        Ok(()) => ipc_ok_empty(),
        Err(e) => ipc_fail_msg(e),
    })
}

/// 删除 SFTP
/// # 参数
/// - state: 状态
/// - id: 会话 ID
/// - remote_path: 远程路径
/// # 返回
/// 一个包含 Result 的删除 SFTP
#[tauri::command]
pub async fn sftp_delete(state: State<'_, Arc<AppState>>, id: String, remote_path: String) -> Result<Value, String> {
    Ok(match sftp::request(&state, &id, |reply| SftpCmd::Delete { remote_path, reply }).await {
        Ok(()) => ipc_ok_empty(),
        Err(e) => ipc_fail_msg(e),
    })
}

/// 重命名 SFTP
/// # 参数
/// - state: 状态
/// - id: 会话 ID
/// - old_path: 旧路径
/// - new_path: 新路径
/// # 返回
/// 一个包含 Result 的重命名 SFTP
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
