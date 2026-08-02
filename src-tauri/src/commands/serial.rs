//! 串口命令

use crate::encoding::{buffer_to_binary_wire, encode_outgoing_terminal_data};
use crate::ipc::{ipc_fail_msg, ipc_ok, ipc_ok_empty};
use crate::serial::{list_ports, parse_data_bits, parse_parity, parse_stop_bits};
use crate::session::stream::StreamSessionHandle;
use crate::session::{AppState, SessionCmd};
use serde_json::{json, Value};
use std::io::{Read, Write};
use std::sync::Arc;
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter, State};
use tokio::sync::mpsc;

/// 列出串口
/// # 返回
/// 一个包含串口的 Value
#[tauri::command]
pub fn serial_list_ports() -> Value {
    match list_ports() {
        Ok(ports) => ipc_ok(json!({ "ports": ports })),
        Err(e) => ipc_fail_msg(e),
    }
}

/// 连接串口
/// # 参数
/// - app: 应用
/// - state: 状态
/// - id: 会话 ID
/// - config: 配置
/// # 返回
/// 一个包含 Result 的连接串口
#[tauri::command]
pub async fn serial_connect(
    app: AppHandle,
    state: State<'_, Arc<AppState>>,
    id: String,
    config: Value,
) -> Result<Value, String> {
    let path = config
        .get("path")
        .and_then(|x| x.as_str())
        .unwrap_or("")
        .to_string();
    if path.is_empty() {
        return Ok(crate::ipc::ipc_fail_known("app.invalidRequest"));
    }
    let baud = config.get("baudRate").and_then(|x| x.as_u64()).unwrap_or(9600) as u32;
    let data_bits = config.get("dataBits").and_then(|x| x.as_u64()).unwrap_or(8) as u8;
    let stop_bits = config.get("stopBits").and_then(|x| x.as_u64()).unwrap_or(1) as u8;
    let parity = config
        .get("parity")
        .and_then(|x| x.as_str())
        .unwrap_or("none")
        .to_string();

    match list_ports() {  // 验证枚举的串口是否存在
        Ok(ports) if !ports.iter().any(|p| p.path == path) => {
            return Ok(ipc_fail_msg("serial.portNotFound"));
        }
        Err(e) => return Ok(ipc_fail_msg(e)),
        _ => {}
    }

    if let Some((_, old)) = state.serial.remove(&id) {  // 断开旧的串口
        let _ = old.cmd_tx.send(SessionCmd::Disconnect);
    }

    let builder = serialport::new(&path, baud)  // 创建串口构建器
        .data_bits(parse_data_bits(data_bits))
        .stop_bits(parse_stop_bits(stop_bits))
        .parity(parse_parity(&parity))
        .timeout(Duration::from_millis(50));

    let port = match builder.open() {  // 打开串口
        Ok(p) => p,
        Err(e) => return Ok(ipc_fail_msg(e.to_string())),
    };

    let (cmd_tx, mut cmd_rx) = mpsc::unbounded_channel::<SessionCmd>();  // 创建命令通道
    state
        .serial
        .insert(id.clone(), StreamSessionHandle { cmd_tx });

    let app2 = app.clone();
    let state2 = state.inner().clone();
    let id2 = id.clone();

    thread::spawn(move || {
        let mut port = port;
        let mut buf = [0u8; 4096];
        loop {
            while let Ok(cmd) = cmd_rx.try_recv() {
                match cmd {
                    SessionCmd::Write(data) => {
                        let _ = port.write_all(&data);
                    }
                    SessionCmd::Disconnect => {
                        state2.serial.remove(&id2);
                        let _ = app2.emit("serial:closed", id2.clone());
                        return;
                    }
                    _ => {}
                }
            }
            match port.read(&mut buf) {
                Ok(0) => thread::sleep(Duration::from_millis(10)),
                Ok(n) => {
                    let wire = buffer_to_binary_wire(&buf[..n]);
                    let _ = app2.emit("serial:output", (id2.clone(), wire));
                }
                Err(ref e)
                    if e.kind() == std::io::ErrorKind::TimedOut
                        || e.kind() == std::io::ErrorKind::WouldBlock =>
                {
                    thread::sleep(Duration::from_millis(5));
                }
                Err(e) => {
                    let msg = format!("\r\n[serial error] {e}\r\n");
                    let _ = app2.emit("serial:output", (id2.clone(), msg));
                    thread::sleep(Duration::from_millis(100));
                }
            }
        }
    });

    Ok(ipc_ok_empty())
}

/// 断开串口
/// # 参数
/// - state: 状态
/// - id: 会话 ID
/// # 返回
/// 一个包含 Result 的断开串口
#[tauri::command]
pub fn serial_disconnect(state: State<'_, Arc<AppState>>, id: String) -> Value {
    if let Some((_, sess)) = state.serial.remove(&id) {
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
pub fn serial_send_data(
    state: State<'_, Arc<AppState>>,
    id: String,
    data: String,
    encoding: Option<String>,
) {
    if let Some(sess) = state.serial.get(&id) {
        let bytes = encode_outgoing_terminal_data(&data, encoding.as_deref());
        let _ = sess.cmd_tx.send(SessionCmd::Write(bytes));
    }
}
