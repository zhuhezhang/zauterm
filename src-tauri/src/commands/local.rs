//! 本机 Shell 命令

use crate::ipc::{ipc_fail_known, ipc_fail_msg, ipc_ok_empty};
use crate::local::{self, LocalConnectConfig};
use crate::session::AppState;
use serde_json::Value;
use std::sync::Arc;
use tauri::{AppHandle, State};

/// 连接本机 Shell
/// # 参数
/// - app: 应用
/// - state: 状态
/// - id: 会话 ID
/// - config: 配置
/// # 返回
/// 一个包含 Result 的连接结果
#[tauri::command]
pub async fn local_connect(
    app: AppHandle,
    state: State<'_, Arc<AppState>>,
    id: String,
    config: Value,
) -> Result<Value, String> {
    let cfg = LocalConnectConfig::from_value(&config);
    let state = state.inner().clone();
    Ok(
        match tokio::task::spawn_blocking(move || local::connect(app, state, id, cfg)).await {
            Ok(Ok(())) => ipc_ok_empty(),
            Ok(Err(code)) if code.contains('.') => ipc_fail_known(&code),
            Ok(Err(e)) => ipc_fail_msg(e),
            Err(e) => ipc_fail_msg(e.to_string()),
        },
    )
}

/// 断开本机 Shell
/// # 参数
/// - state: 状态
/// - id: 会话 ID
/// # 返回
/// 断开结果
#[tauri::command]
pub fn local_disconnect(state: State<'_, Arc<AppState>>, id: String) -> Value {
    local::disconnect(&state, &id);
    ipc_ok_empty()
}

/// 发送数据
/// # 参数
/// - state: 状态
/// - id: 会话 ID
/// - data: 数据
/// - encoding: 编码
#[tauri::command]
pub fn local_send_data(
    state: State<'_, Arc<AppState>>,
    id: String,
    data: String,
    encoding: Option<String>,
) {
    local::send_data(&state, &id, &data, encoding.as_deref());
}

/// 调整 PTY 大小
/// # 参数
/// - state: 状态
/// - id: 会话 ID
/// - cols: 列
/// - rows: 行
#[tauri::command]
pub fn local_resize(state: State<'_, Arc<AppState>>, id: String, cols: u32, rows: u32) {
    local::resize(&state, &id, cols, rows);
}
