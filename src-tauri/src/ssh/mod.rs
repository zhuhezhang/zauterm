//! 通过 libssh2（ssh2 crate）实现 SSH 交互式 shell

mod algorithms;

pub use algorithms::AlgorithmPreferences;

use crate::encoding::{buffer_to_binary_wire, encode_outgoing_terminal_data};
use crate::known_hosts;
use crate::session::{ssh::SshSessionHandle, AppState, SessionCmd};
use algorithms::{apply_algorithm_preferences, parse_algorithms};
use serde_json::Value;
use ssh2::Session;
use std::io::{Read, Write};
use std::net::TcpStream;
use std::sync::Arc;
use std::thread;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};
use tokio::sync::mpsc;

/// SSH连接配置
pub struct SshConnectConfig {
    /// 主机名或 IP 地址
    pub host: String,
    /// 端口号
    pub port: u16,
    /// 用户名
    pub username: String,
    /// 密码
    pub password: Option<String>,
    /// 私钥
    pub private_key: Option<String>,
    /// 密码
    pub passphrase: Option<String>,
    /// 心跳间隔时间（秒，0 / None = 关闭）
    pub keepalive_interval: Option<u64>,
    /// SSH 算法偏好（设置 UI → 连接 payload `algorithms`）
    pub algorithms: Option<AlgorithmPreferences>,
}

impl SshConnectConfig {
    /// 从 JSON 值创建 SSH 连接配置
    pub fn from_value(v: &Value) -> Self {
        Self {
            host: v
                .get("host")
                .and_then(|x| x.as_str())
                .unwrap_or("")
                .to_string(),
            port: v
                .get("port")
                .and_then(|x| x.as_u64())
                .unwrap_or(22) as u16,
            username: v
                .get("username")
                .and_then(|x| x.as_str())
                .unwrap_or("")
                .to_string(),
            password: v
                .get("password")
                .and_then(|x| x.as_str())
                .map(|s| s.to_string())
                .filter(|s| !s.is_empty()),
            private_key: v
                .get("privateKey")
                .and_then(|x| x.as_str())
                .map(|s| s.to_string())
                .filter(|s| !s.is_empty()),
            passphrase: v
                .get("passphrase")
                .and_then(|x| x.as_str())
                .map(|s| s.to_string())
                .filter(|s| !s.is_empty()),
            keepalive_interval: v.get("sshKeepaliveInterval").and_then(|x| x.as_u64()),
            algorithms: parse_algorithms(v),
        }
    }
}

/// 在 handshake 前应用算法偏好
/// # 参数
/// - sess: SSH 会话
/// - config: SSH 连接配置
/// # 返回
/// 一个包含 Result<(), String> 的异步结果，如果应用成功则返回 Ok(())，否则返回 Err(String)
pub fn prepare_session(sess: &Session, config: &SshConnectConfig) -> Result<(), String> {
    if let Some(ref prefs) = config.algorithms {
        apply_algorithm_preferences(sess, prefs)?;
    }
    Ok(())
}

/// 认证成功后配置 keepalive（非阻塞会话须在循环中调用 keepalive_send）
/// # 参数
/// - sess: SSH 会话
/// - config: SSH 连接配置
/// # 返回
/// 一个包含 bool 的布尔值，如果启用成功则返回 true，否则返回 false
pub fn enable_keepalive(sess: &Session, config: &SshConnectConfig) -> bool {
    if let Some(secs) = config.keepalive_interval {
        if secs > 0 {
            sess.set_keepalive(true, secs as u32);
            return true;
        }
    }
    false
}

/// 按需发送 keepalive；返回下次应再检查的时刻
/// # 参数
/// - sess: SSH 会话
/// - enabled: 是否启用 keepalive
/// - next_at: 下次应再检查的时刻
/// # 返回
/// 一个包含 Result<(), String> 的异步结果，如果发送成功则返回 Ok(())，否则返回 Err(String)
pub fn tick_keepalive(sess: &Session, enabled: bool, next_at: &mut Instant) {
    if !enabled || Instant::now() < *next_at {
        return;
    }
    match sess.keepalive_send() {
        Ok(wait_secs) => {
            *next_at = Instant::now() + Duration::from_secs(u64::from(wait_secs.max(1)));
        }
        Err(_) => {
            *next_at = Instant::now() + Duration::from_secs(5);
        }
    }
}

/// 连接到 SSH 服务器
/// # 参数
/// - app: 应用程序句柄
/// - state: 应用程序状态
/// - id: 会话 ID
/// - config: SSH 连接配置
/// # 返回
/// 一个包含 Result<(), String> 的异步结果，如果连接成功则返回 Ok(())，否则返回 Err(String)
pub async fn connect(
    app: AppHandle,
    state: Arc<AppState>,
    id: String,
    config: SshConnectConfig,
) -> Result<(), String> {
    if config.host.is_empty() || config.username.is_empty() {
        return Err("ssh.invalidConfig".into());
    }
    if let Some((_, old)) = state.ssh.remove(&id) {
        let _ = old.cmd_tx.send(SessionCmd::Disconnect);
    }

    let (cmd_tx, cmd_rx) = mpsc::unbounded_channel::<SessionCmd>();
    let (ready_tx, ready_rx) = tokio::sync::oneshot::channel::<Result<(), String>>();

    let app2 = app.clone();
    let state2 = state.clone();
    let id2 = id.clone();

    thread::spawn(move || {
        let result = run_ssh_session(app2, state2, id2, config, cmd_rx, ready_tx);
        if let Err(e) = result {
            eprintln!("ssh session ended with error: {e}");
        }
    });

    match ready_rx.await {  // 等待连接结果
        Ok(Ok(())) => {
            state.ssh.insert(id, SshSessionHandle { cmd_tx });  // 插入会话句柄
            Ok(())
        }
        Ok(Err(e)) => Err(e),  // 返回错误
        Err(_) => Err("ssh.connectFailed".into()),  // 返回连接失败错误
    }
}

/// 解析地址
/// # 参数
/// - host: 主机名或 IP 地址
/// - port: 端口号
/// # 返回
/// 一个包含 Result<std::net::SocketAddr, String> 的异步结果，如果解析成功则返回 Ok(std::net::SocketAddr)，否则返回 Err(String)
fn resolve_addr(host: &str, port: u16) -> Result<std::net::SocketAddr, String> {
    use std::net::ToSocketAddrs;  // 导入 ToSocketAddrs trait
    format!("{host}:{port}")
        .to_socket_addrs()
        .map_err(|e| e.to_string())?
        .next()
        .ok_or_else(|| "ssh.resolveFailed".into())
}

/// 失败准备
/// # 参数
/// - ready_tx: 准备发送器
/// - msg: 错误信息
/// # 返回
/// 一个包含 String 的错误信息
fn fail_ready(
    ready_tx: &mut Option<tokio::sync::oneshot::Sender<Result<(), String>>>,
    msg: String,
) -> String {
    if let Some(tx) = ready_tx.take() {  // 发送错误
        let _ = tx.send(Err(msg.clone()));
    }
    msg
}

/// 运行 SSH 会话
/// # 参数
/// - app: 应用程序句柄
/// - state: 应用程序状态
/// - id: 会话 ID
/// - config: SSH 连接配置
/// - cmd_rx: 命令接收器
/// - ready_tx: 准备发送器
/// # 返回
/// 一个包含 Result<(), String> 的异步结果，如果会话成功则返回 Ok(())，否则返回 Err(String)
fn run_ssh_session(
    app: AppHandle,
    state: Arc<AppState>,
    id: String,
    config: SshConnectConfig,
    mut cmd_rx: mpsc::UnboundedReceiver<SessionCmd>,
    ready_tx: tokio::sync::oneshot::Sender<Result<(), String>>,
) -> Result<(), String> {
    let mut ready_tx = Some(ready_tx);  // 设置准备发送器
    let addr = match resolve_addr(&config.host, config.port) {  // 解析地址
        Ok(a) => a,
        Err(e) => return Err(fail_ready(&mut ready_tx, e)),  // 返回错误
    };
    let tcp = match TcpStream::connect_timeout(&addr, Duration::from_secs(15)) {  // 连接到 TCP 流
        Ok(t) => t,
        Err(e) => return Err(fail_ready(&mut ready_tx, e.to_string())),  // 返回错误
    };
    tcp.set_read_timeout(Some(Duration::from_millis(50))).ok();  // 设置读取超时时间
    tcp.set_write_timeout(Some(Duration::from_secs(30))).ok();  // 设置写入超时时间
    let mut sess = match Session::new() {  // 创建 SSH 会话
        Ok(s) => s,
        Err(e) => return Err(fail_ready(&mut ready_tx, e.to_string())),  // 返回错误
    };
    sess.set_tcp_stream(tcp);
    if let Err(e) = prepare_session(&sess, &config) {
        return Err(fail_ready(&mut ready_tx, e));
    }
    if let Err(e) = sess.handshake() {
        return Err(fail_ready(&mut ready_tx, e.to_string()));
    }

    let (host_key, host_key_type) = match sess.host_key() {
        Some(v) => v,
        None => return Err(fail_ready(&mut ready_tx, "ssh.noHostKey".into())),
    };
    let fp_ok = {
        let app_c = app.clone();
        let st = state.clone();
        let host = config.host.clone();
        let port = config.port;
        let key = host_key.to_vec();
        let key_type = format!("{host_key_type:?}");
        tauri::async_runtime::block_on(async move {
            let lang = st.ui_language.lock().clone();
            known_hosts::verify_host_key_with_lang(
                &app_c,
                &st.known_hosts,
                &host,
                port,
                &key,
                &key_type,
                &lang,
            )
            .await
            .unwrap_or(false)
        })
    };
    if !fp_ok {
        return Err(fail_ready(&mut ready_tx, "ssh.hostKeyRejected".into()));
    }

    let mut authed = false;
    if let Some(ref key_pem) = config.private_key {
        let key_data = match crate::ssh_key::resolve_private_key_material(key_pem) {
            Ok(k) => k,
            Err(e) => return Err(fail_ready(&mut ready_tx, e)),
        };
        let pass = config.passphrase.clone().unwrap_or_default();
        let pass_opt = if pass.is_empty() { None } else { Some(pass.as_str()) };
        if sess
            .userauth_pubkey_memory(&config.username, None, &key_data, pass_opt)
            .is_ok()
            && sess.authenticated()
        {
            authed = true;
        }
    }
    if !authed {
        if let Some(ref pw) = config.password {
            if let Err(e) = sess.userauth_password(&config.username, pw) {
                return Err(fail_ready(&mut ready_tx, e.to_string()));
            }
            authed = sess.authenticated();
        }
    }
    if !authed {
        return Err(fail_ready(&mut ready_tx, "ssh.authFailed".into()));
    }

    let keepalive_on = enable_keepalive(&sess, &config);
    let mut next_keepalive = Instant::now();

    let mut channel = match sess.channel_session() {
        Ok(c) => c,
        Err(e) => return Err(fail_ready(&mut ready_tx, e.to_string())),
    };
    if let Err(e) = channel.request_pty("xterm-256color", None, None) {
        return Err(fail_ready(&mut ready_tx, e.to_string()));
    }
    if let Err(e) = channel.shell() {
        return Err(fail_ready(&mut ready_tx, e.to_string()));
    }
    sess.set_blocking(false);

    if let Some(tx) = ready_tx.take() {
        let _ = tx.send(Ok(()));
    }

    let mut buf = [0u8; 8192];
    loop {
        // cmds
        while let Ok(cmd) = cmd_rx.try_recv() {
            match cmd {
                SessionCmd::Write(data) => {
                    let _ = channel.write_all(&data);
                }
                SessionCmd::Resize { cols, rows } => {
                    let _ = channel.request_pty_size(cols as u32, rows as u32, None, None);
                }
                SessionCmd::Disconnect => {
                    let _ = channel.close();
                    let _ = app.emit("ssh:closed", id.clone());
                    state.ssh.remove(&id);
                    return Ok(());
                }
            }
        }

        tick_keepalive(&sess, keepalive_on, &mut next_keepalive);

        match channel.read(&mut buf) {
            Ok(0) => {
                // eof
                break;
            }
            Ok(n) => {
                let wire = buffer_to_binary_wire(&buf[..n]);
                let _ = app.emit("ssh:output", (id.clone(), wire));
            }
            Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock || e.kind() == std::io::ErrorKind::TimedOut => {
                thread::sleep(Duration::from_millis(10));
            }
            Err(_) => break,
        }

        if channel.eof() {
            break;
        }
    }

    let _ = app.emit("ssh:closed", id.clone());
    state.ssh.remove(&id);
    Ok(())
}

/// 发送数据
/// # 参数
/// - state: 应用程序状态
/// - id: 会话 ID
/// - data: 数据
/// - encoding: 编码
/// # 返回
/// 一个包含 Result<(), String> 的异步结果，如果发送成功则返回 Ok(())，否则返回 Err(String)
pub fn send_data(state: &AppState, id: &str, data: &str, encoding: Option<&str>) {
    if let Some(sess) = state.ssh.get(id) {
        let bytes = encode_outgoing_terminal_data(data, encoding);
        let _ = sess.cmd_tx.send(SessionCmd::Write(bytes));
    }
}

/// 调整大小
/// # 参数
/// - state: 应用程序状态
/// - id: 会话 ID
/// - cols: 列数
/// - rows: 行数
/// # 返回
/// 一个包含 Result<(), String> 的异步结果，如果调整成功则返回 Ok(())，否则返回 Err(String)
pub fn resize(state: &AppState, id: &str, cols: u32, rows: u32) {
    if let Some(sess) = state.ssh.get(id) {
        let _ = sess.cmd_tx.send(SessionCmd::Resize { cols, rows });
    }
}

/// 断开连接
/// # 参数
/// - state: 应用程序状态
/// - id: 会话 ID
/// # 返回
/// 一个包含 Result<(), String> 的异步结果，如果断开成功则返回 Ok(())，否则返回 Err(String)
pub fn disconnect(state: &AppState, id: &str) {
    if let Some((_, sess)) = state.ssh.remove(id) {
        let _ = sess.cmd_tx.send(SessionCmd::Disconnect);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    /// 测试从 JSON 值创建 SSH 连接配置
    #[test]
    fn from_value_parses_algorithms_and_keepalive() {
        let v = json!({
            "host": "example.com",
            "port": 2222,
            "username": "u",
            "sshKeepaliveInterval": 30,
            "algorithms": {
                "kex": ["curve25519-sha256"],
                "serverHostKey": ["ssh-ed25519"],
                "cipher": ["chacha20-poly1305@openssh.com"],
                "hmac": ["hmac-sha2-256"],
                "compress": ["none"]
            }
        });
        let cfg = SshConnectConfig::from_value(&v);
        assert_eq!(cfg.host, "example.com");
        assert_eq!(cfg.port, 2222);
        assert_eq!(cfg.keepalive_interval, Some(30));
        let alg = cfg.algorithms.expect("algorithms");
        assert_eq!(alg.kex, vec!["curve25519-sha256"]);
        assert_eq!(alg.cipher, vec!["chacha20-poly1305@openssh.com"]);
    }
}
