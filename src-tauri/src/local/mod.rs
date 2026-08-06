//! 本机交互式 Shell（跨平台 PTY）

use crate::encoding::{buffer_to_binary_wire, encode_outgoing_terminal_data};
use crate::path_policy::{assert_path_allowed, collect_resolved_roots};
use crate::session::stream::StreamSessionHandle;
use crate::session::{AppState, SessionCmd};
use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use serde_json::Value;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};
use tokio::sync::mpsc;

/// 本地 Shell 连接配置
pub struct LocalConnectConfig {
    /// Shell 可执行文件路径（空则系统默认）
    pub shell: String,
    /// 工作目录（空则用户家目录）
    pub cwd: String,
    /// 初始列数
    pub cols: u16,
    /// 初始行数
    pub rows: u16,
}

impl LocalConnectConfig {
    /// 从 JSON 值创建本地连接配置
    pub fn from_value(v: &Value) -> Self {
        Self {
            shell: v
                .get("shell")
                .and_then(|x| x.as_str())
                .unwrap_or("")
                .trim()
                .to_string(),
            cwd: v
                .get("cwd")
                .and_then(|x| x.as_str())
                .unwrap_or("")
                .trim()
                .to_string(),
            cols: v
                .get("cols")
                .and_then(|x| x.as_u64())
                .unwrap_or(80)
                .clamp(1, 9999) as u16,
            rows: v
                .get("rows")
                .and_then(|x| x.as_u64())
                .unwrap_or(24)
                .clamp(1, 9999) as u16,
        }
    }
}

/// 系统默认 Shell
/// # 返回
/// 系统默认 Shell 路径
fn default_shell() -> String {
    #[cfg(windows)]
    {
        std::env::var("COMSPEC").unwrap_or_else(|_| {
            std::env::var("ComSpec").unwrap_or_else(|_| "powershell.exe".into())
        })
    }
    #[cfg(not(windows))]
    {
        std::env::var("SHELL").unwrap_or_else(|_| "/bin/sh".into())
    }
}

/// 解析并校验 Shell 路径
/// # 参数
/// - shell: Shell 路径
/// # 返回
/// 成功返回 Ok(Shell 路径)，失败返回 i18n 错误码或原文
fn resolve_shell(shell: &str) -> Result<String, String> {
    let path = if shell.is_empty() {
        default_shell()
    } else {
        shell.to_string()
    };
    if path.contains('\0') {
        return Err("local.shellInvalid".into());
    }
    let p = Path::new(&path);
    // 带路径分隔符的显式路径须存在；裸命令名（如 powershell.exe）交给系统 PATH 解析
    if path.contains('/') || path.contains('\\') {
        if !p.is_file() {
            return Err("local.shellNotFound".into());
        }
    }
    Ok(path)
}

/// 解析并校验工作目录
/// # 参数
/// - cwd: 工作目录
/// - app_data: 应用数据目录
/// # 返回
/// 成功返回 Ok(工作目录)，失败返回 i18n 错误码或原文
fn resolve_cwd(cwd: &str, app_data: &Path) -> Result<PathBuf, String> {
    let dir = if cwd.is_empty() {
        dirs::home_dir().ok_or_else(|| "local.cwdInvalid".to_string())?
    } else {
        let p = PathBuf::from(cwd);
        if cwd.contains('\0') {
            return Err("local.cwdInvalid".into());
        }
        if !p.is_dir() {
            return Err("local.cwdNotFound".into());
        }
        let roots = collect_resolved_roots(app_data);
        assert_path_allowed(&p, &roots).map_err(|_| "local.cwdDenied".to_string())?;
        p
    };
    Ok(dir)
}

/// 连接本机 Shell
/// # 参数
/// - app: 应用
/// - state: 状态
/// - id: 会话 ID
/// - config: 配置
/// # 返回
/// 成功返回 Ok(())，失败返回 i18n 错误码或原文
pub fn connect(
    app: AppHandle,
    state: Arc<AppState>,
    id: String,
    config: LocalConnectConfig,
) -> Result<(), String> {
    if let Some((_, old)) = state.local.remove(&id) {
        let _ = old.cmd_tx.send(SessionCmd::Disconnect);
    }

    let app_data = app
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| std::env::temp_dir());
    let shell = resolve_shell(&config.shell)?;
    let cwd = resolve_cwd(&config.cwd, &app_data)?;

    let pty_system = native_pty_system();
    let pair = pty_system
        .openpty(PtySize {
            rows: config.rows,
            cols: config.cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| e.to_string())?;

    let mut cmd = CommandBuilder::new(&shell);
    cmd.cwd(cwd);
    cmd.env("TERM", "xterm-256color");
    cmd.env("COLORTERM", "truecolor");
    // 交互式登录式体验：Unix 下常见为 -l
    #[cfg(not(windows))]
    {
        let base = Path::new(&shell)
            .file_name()
            .and_then(|s| s.to_str())
            .unwrap_or("");
        if matches!(base, "bash" | "zsh" | "fish" | "sh" | "dash" | "ksh") {
            cmd.arg("-l");
        }
    }

    let mut child = pair
        .slave
        .spawn_command(cmd)
        .map_err(|e| e.to_string())?;
    drop(pair.slave);

    let mut reader = pair
        .master
        .try_clone_reader()
        .map_err(|e| e.to_string())?;
    let mut writer = pair.master.take_writer().map_err(|e| e.to_string())?;
    let master: Arc<Mutex<Box<dyn MasterPty + Send>>> = Arc::new(Mutex::new(pair.master));
    let mut killer = child.clone_killer();

    let (cmd_tx, mut cmd_rx) = mpsc::unbounded_channel::<SessionCmd>();
    state
        .local
        .insert(id.clone(), StreamSessionHandle { cmd_tx });

    let app_read = app.clone();
    let id_read = id.clone();
    let reader_done = Arc::new(AtomicBool::new(false));
    let reader_done2 = reader_done.clone();

    thread::spawn(move || {
        let mut buf = [0u8; 8192];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    let wire = buffer_to_binary_wire(&buf[..n]);
                    let _ = app_read.emit("local:output", (id_read.clone(), wire));
                }
                Err(_) => break,
            }
        }
        reader_done2.store(true, Ordering::SeqCst);
    });

    let app2 = app.clone();
    let state2 = state.clone();
    let id2 = id.clone();
    let master2 = master.clone();

    thread::spawn(move || {
        loop {
            match cmd_rx.try_recv() {
                Ok(SessionCmd::Write(data)) => {
                    if writer.write_all(&data).is_err() {
                        break;
                    }
                    let _ = writer.flush();
                }
                Ok(SessionCmd::Resize { cols, rows }) => {
                    if let Ok(m) = master2.lock() {
                        let _ = m.resize(PtySize {
                            rows: rows.clamp(1, 9999) as u16,
                            cols: cols.clamp(1, 9999) as u16,
                            pixel_width: 0,
                            pixel_height: 0,
                        });
                    }
                }
                Ok(SessionCmd::Disconnect) => {
                    let _ = killer.kill();
                    break;
                }
                Err(mpsc::error::TryRecvError::Disconnected) => {
                    let _ = killer.kill();
                    break;
                }
                Err(mpsc::error::TryRecvError::Empty) => {
                    if reader_done.load(Ordering::SeqCst) {
                        break;
                    }
                    match child.try_wait() {
                        Ok(Some(_)) => break,
                        Ok(None) => thread::sleep(Duration::from_millis(10)),
                        Err(_) => break,
                    }
                }
            }
        }
        let _ = killer.kill();
        let _ = child.wait();
        state2.local.remove(&id2);
        let _ = app2.emit("local:closed", id2);
    });

    Ok(())
}

/// 断开本机 Shell
/// # 参数
/// - state: 状态
/// - id: 会话 ID
pub fn disconnect(state: &AppState, id: &str) {
    if let Some((_, sess)) = state.local.remove(id) {
        let _ = sess.cmd_tx.send(SessionCmd::Disconnect);
    }
}

/// 向本机 Shell 发送数据
/// # 参数
/// - state: 状态
/// - id: 会话 ID
/// - data: 数据
/// - encoding: 编码
pub fn send_data(state: &AppState, id: &str, data: &str, encoding: Option<&str>) {
    if let Some(sess) = state.local.get(id) {
        let bytes = encode_outgoing_terminal_data(data, encoding);
        let _ = sess.cmd_tx.send(SessionCmd::Write(bytes));
    }
}

/// 调整本机 PTY 大小
/// # 参数
/// - state: 状态
/// - id: 会话 ID
/// - cols: 列数
/// - rows: 行数
pub fn resize(state: &AppState, id: &str, cols: u32, rows: u32) {
    if let Some(sess) = state.local.get(id) {
        let _ = sess.cmd_tx.send(SessionCmd::Resize { cols, rows });
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 测试系统默认 Shell 路径是否非空
    #[test]
    fn default_shell_is_non_empty() {
        assert!(!default_shell().is_empty());
    }

    /// 测试解析 Shell 路径是否拒绝 NUL 字符
    #[test]
    fn resolve_shell_rejects_nul() {
        assert_eq!(
            resolve_shell("foo\0bar").unwrap_err(),
            "local.shellInvalid"
        );
    }

    /// 测试解析空 Shell 路径是否使用系统默认 Shell
    #[test]
    fn resolve_shell_empty_uses_default() {
        let s = resolve_shell("").unwrap();
        assert_eq!(s, default_shell());
    }
}
