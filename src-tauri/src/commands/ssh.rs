//! SSH 命令

use crate::ipc::{ipc_fail_known, ipc_fail_msg, ipc_ok_empty};
use crate::session::AppState;
use crate::ssh::{self, SshConnectConfig};
use serde_json::Value;
use std::sync::Arc;
use tauri::{AppHandle, State};

/// 连接 SSH
/// # 参数
/// - app: 应用
/// - state: 状态
/// - id: 会话 ID
/// - config: 配置
/// # 返回
/// 一个包含 Result 的连接 SSH
#[tauri::command]
pub async fn ssh_connect(
    app: AppHandle,
    state: State<'_, Arc<AppState>>,
    id: String,
    config: Value,
) -> Result<Value, String> {
    let cfg = SshConnectConfig::from_value(&config);
    Ok(match ssh::connect(app, state.inner().clone(), id, cfg).await {
        Ok(()) => ipc_ok_empty(),
        Err(code) if code.contains('.') => ipc_fail_known(&code),
        Err(e) => ipc_fail_msg(e),
    })
}

/// 断开 SSH
/// # 参数
/// - state: 状态
/// - id: 会话 ID
/// # 返回
/// 一个包含 Result 的断开 SSH
#[tauri::command]
pub fn ssh_disconnect(state: State<'_, Arc<AppState>>, id: String) -> Value {
    ssh::disconnect(&state, &id);
    ipc_ok_empty()
}

/// 发送数据
/// # 参数
/// - state: 状态
/// - id: 会话 ID
/// - data: 数据
/// - encoding: 编码
/// # 返回
/// 一个包含 Result 的发送数据
#[tauri::command]
pub fn ssh_send_data(state: State<'_, Arc<AppState>>, id: String, data: String, encoding: Option<String>) {
    ssh::send_data(&state, &id, &data, encoding.as_deref());
}

/// 调整大小
/// # 参数
/// - state: 状态
/// - id: 会话 ID
/// - cols: 列
/// - rows: 行
/// # 返回
/// 一个包含 Result 的调整大小
#[tauri::command]
pub fn ssh_resize(state: State<'_, Arc<AppState>>, id: String, cols: u32, rows: u32) {
    ssh::resize(&state, &id, cols, rows);
}
