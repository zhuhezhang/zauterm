//! Telnet 命令

use crate::encoding::{buffer_to_binary_wire, encode_outgoing_terminal_data};
use crate::ipc::{ipc_fail_known, ipc_fail_msg, ipc_ok_empty};
use crate::session::stream::StreamSessionHandle;
use crate::session::{AppState, SessionCmd};
use crate::telnet::TelnetStripper;
use serde_json::Value;
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter, State};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;
use tokio::sync::mpsc;

/// 连接 Telnet
/// # 参数
/// - app: 应用
/// - state: 状态
/// - id: 会话 ID
/// - config: 配置
/// # 返回
/// 一个包含 Result 的连接 Telnet
#[tauri::command]
pub async fn telnet_connect(
    app: AppHandle,
    state: State<'_, Arc<AppState>>,
    id: String,
    config: Value,
) -> Result<Value, String> {
    let host = config
        .get("host")
        .and_then(|x| x.as_str())
        .unwrap_or("")
        .to_string();
    let port = config.get("port").and_then(|x| x.as_u64()).unwrap_or(23) as u16;
    if host.is_empty() {
        return Ok(ipc_fail_known("app.invalidRequest"));
    }
    if let Some((_, old)) = state.telnet.remove(&id) {
        let _ = old.cmd_tx.send(SessionCmd::Disconnect);
    }

    let connect_result = tokio::time::timeout(
        Duration::from_secs(10),
        TcpStream::connect((host.as_str(), port)),
    )
    .await;

    let stream = match connect_result {
        Ok(Ok(s)) => s,
        Ok(Err(e)) => return Ok(ipc_fail_msg(e.to_string())),
        Err(_) => return Ok(ipc_fail_known("telnet.connectionTimeout")),
    };

    let (cmd_tx, mut cmd_rx) = mpsc::unbounded_channel::<SessionCmd>();
    state
        .telnet
        .insert(id.clone(), StreamSessionHandle { cmd_tx });

    let app2 = app.clone();
    let state2 = state.inner().clone();
    let id2 = id.clone();
    tokio::spawn(async move {
        let (mut reader, mut writer) = stream.into_split();
        let mut stripper = TelnetStripper::default();
        let mut buf = [0u8; 8192];
        loop {
            tokio::select! {
                cmd = cmd_rx.recv() => {
                    match cmd {
                        Some(SessionCmd::Write(data)) => {
                            if writer.write_all(&data).await.is_err() { break; }
                        }
                        Some(SessionCmd::Disconnect) | None => { break; }
                        _ => {}
                    }
                }
                n = reader.read(&mut buf) => {
                    match n {
                        Ok(0) => break,
                        Ok(n) => {
                            let processed = stripper.strip(&buf[..n]);
                            if !processed.is_empty() {
                                let wire = buffer_to_binary_wire(&processed);
                                let _ = app2.emit("telnet:output", (id2.clone(), wire));
                            }
                        }
                        Err(_) => break,
                    }
                }
            }
        }
        stripper.clear();
        state2.telnet.remove(&id2);
        let _ = app2.emit("telnet:closed", id2);
    });

    Ok(ipc_ok_empty())
}

/// 断开 Telnet
/// # 参数
/// - state: 状态
/// - id: 会话 ID
/// # 返回
/// 一个包含 Result 的断开 Telnet
#[tauri::command]
pub fn telnet_disconnect(state: State<'_, Arc<AppState>>, id: String) -> Value {
    if let Some((_, sess)) = state.telnet.remove(&id) {
        let _ = sess.cmd_tx.send(SessionCmd::Disconnect);
    }
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
pub fn telnet_send_data(
    state: State<'_, Arc<AppState>>,
    id: String,
    data: String,
    encoding: Option<String>,
) {
    if let Some(sess) = state.telnet.get(&id) {
        let bytes = encode_outgoing_terminal_data(&data, encoding.as_deref());
        let _ = sess.cmd_tx.send(SessionCmd::Write(bytes));
    }
}
