//! SFTP via libssh2

use crate::encoding::buffer_to_binary_wire;
use crate::known_hosts;
use crate::path_policy::{assert_path_allowed, collect_resolved_roots};
use crate::session::sftp::{SftpCmd, SftpSessionHandle};
use crate::session::AppState;
use crate::ssh::SshConnectConfig;
use serde_json::{json, Value};
use ssh2::{FileStat, Session};
use std::io::{Read, Write};
use std::net::TcpStream;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};
use tokio::sync::{mpsc, oneshot};

pub async fn connect(
    app: AppHandle,
    state: Arc<AppState>,
    id: String,
    config: SshConnectConfig,
) -> Result<(), String> {
    if let Some((_, old)) = state.sftp.remove(&id) {
        let _ = old.cmd_tx.send(SftpCmd::Disconnect);
    }
    let (cmd_tx, cmd_rx) = mpsc::unbounded_channel::<SftpCmd>();
    let (ready_tx, ready_rx) = oneshot::channel::<Result<(), String>>();
    let app2 = app.clone();
    let state2 = state.clone();
    let id2 = id.clone();
    thread::spawn(move || {
        let _ = run_sftp_session(app2, state2, id2, config, cmd_rx, ready_tx);
    });
    match ready_rx.await {
        Ok(Ok(())) => {
            state.sftp.insert(id, SftpSessionHandle { cmd_tx });
            Ok(())
        }
        Ok(Err(e)) => Err(e),
        Err(_) => Err("sftp.connectFailed".into()),
    }
}

fn resolve_addr(host: &str, port: u16) -> Result<std::net::SocketAddr, String> {
    use std::net::ToSocketAddrs;
    format!("{host}:{port}")
        .to_socket_addrs()
        .map_err(|e| e.to_string())?
        .next()
        .ok_or_else(|| "ssh.resolveFailed".into())
}

fn open_ssh_session(
    app: &AppHandle,
    state: &Arc<AppState>,
    id: &str,
    config: &SshConnectConfig,
) -> Result<Session, String> {
    let addr = resolve_addr(&config.host, config.port)?;
    let tcp = TcpStream::connect_timeout(&addr, Duration::from_secs(15)).map_err(|e| e.to_string())?;
    tcp.set_read_timeout(Some(Duration::from_secs(30))).ok();
    let mut sess = Session::new().map_err(|e| e.to_string())?;
    sess.set_tcp_stream(tcp);
    sess.handshake().map_err(|e| e.to_string())?;

    let (host_key, host_key_type) = sess.host_key().ok_or_else(|| "ssh.noHostKey".to_string())?;
    let ok = {
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
    if !ok {
        return Err("ssh.hostKeyRejected".into());
    }

    let mut authed = false;
    if let Some(ref key_pem) = config.private_key {
        let key_data = if key_pem.contains("BEGIN") {
            key_pem.clone()
        } else {
            std::fs::read_to_string(key_pem).map_err(|e| e.to_string())?
        };
        let tmp = std::env::temp_dir().join(format!("zterm-sftp-key-{id}.pem"));
        std::fs::write(&tmp, &key_data).map_err(|e| e.to_string())?;
        let pass = config.passphrase.clone().unwrap_or_default();
        let res = sess.userauth_pubkey_file(
            &config.username,
            None,
            &tmp,
            if pass.is_empty() { None } else { Some(&pass) },
        );
        let _ = std::fs::remove_file(&tmp);
        if res.is_ok() && sess.authenticated() {
            authed = true;
        }
    }
    if !authed {
        if let Some(ref pw) = config.password {
            sess.userauth_password(&config.username, pw)
                .map_err(|e| e.to_string())?;
            authed = sess.authenticated();
        }
    }
    if !authed {
        return Err("ssh.authFailed".into());
    }
    Ok(sess)
}

fn run_sftp_session(
    app: AppHandle,
    state: Arc<AppState>,
    id: String,
    config: SshConnectConfig,
    mut cmd_rx: mpsc::UnboundedReceiver<SftpCmd>,
    ready_tx: oneshot::Sender<Result<(), String>>,
) -> Result<(), String> {
    let sess = match open_ssh_session(&app, &state, &id, &config) {
        Ok(s) => s,
        Err(e) => {
            let _ = ready_tx.send(Err(e.clone()));
            return Err(e);
        }
    };
    let sftp = match sess.sftp() {
        Ok(s) => s,
        Err(e) => {
            let msg = e.to_string();
            let _ = ready_tx.send(Err(msg.clone()));
            return Err(msg);
        }
    };
    let _ = ready_tx.send(Ok(()));

    let app_data = app.path().app_data_dir().unwrap_or_else(|_| PathBuf::from("."));
    let roots = collect_resolved_roots(&app_data);

    while let Some(cmd) = cmd_rx.blocking_recv() {
        match cmd {
            SftpCmd::Disconnect => break,
            SftpCmd::List { remote_path, reply } => {
                let r = list_dir(&sftp, &remote_path);
                let _ = reply.send(r);
            }
            SftpCmd::Download {
                remote_path,
                local_path,
                reply,
            } => {
                let r = download_file(&app, &id, &sftp, &remote_path, &local_path, &roots);
                let _ = reply.send(r);
            }
            SftpCmd::DownloadDir {
                remote_dir,
                local_dir,
                reply,
            } => {
                let r = download_dir(&app, &id, &sftp, &remote_dir, &local_dir, &roots);
                let _ = reply.send(r);
            }
            SftpCmd::Upload {
                local_path,
                remote_path,
                reply,
            } => {
                let r = upload_file(&app, &id, &sftp, &local_path, &remote_path, &roots);
                let _ = reply.send(r);
            }
            SftpCmd::UploadBytes {
                remote_path,
                data,
                reply,
            } => {
                let r = upload_bytes(&app, &id, &sftp, &remote_path, &data);
                let _ = reply.send(r);
            }
            SftpCmd::Mkdir { remote_path, reply } => {
                let r = sftp.mkdir(Path::new(&remote_path), 0o755).map_err(|e| e.to_string());
                let _ = reply.send(r);
            }
            SftpCmd::Delete { remote_path, reply } => {
                let r = delete_path(&sftp, &remote_path);
                let _ = reply.send(r);
            }
            SftpCmd::Rename {
                old_path,
                new_path,
                reply,
            } => {
                let r = sftp
                    .rename(Path::new(&old_path), Path::new(&new_path), None)
                    .map_err(|e| e.to_string());
                let _ = reply.send(r);
            }
        }
    }
    state.sftp.remove(&id);
    Ok(())
}

fn list_dir(sftp: &ssh2::Sftp, remote_path: &str) -> Result<Value, String> {
    let entries = sftp
        .readdir(Path::new(remote_path))
        .map_err(|e| e.to_string())?;
    let mut items = Vec::new();
    for (path, stat) in entries {
        let name = path
            .file_name()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_default();
        if name == "." || name == ".." {
            continue;
        }
        let is_dir = stat.is_dir();
        // Match Electron SftpEntry: type / isDir / mtime(ms)
        let mtime_ms = stat.mtime.unwrap_or(0).saturating_mul(1000);
        let full_path = path.to_string_lossy().replace('\\', "/");
        items.push(json!({
            "name": name,
            "type": if is_dir { "d" } else { "-" },
            "path": full_path,
            "isDir": is_dir,
            "size": stat.size.unwrap_or(0),
            "mtime": mtime_ms,
        }));
    }
    items.sort_by(|a, b| {
        let a_dir = a.get("isDir").and_then(|v| v.as_bool()).unwrap_or(false);
        let b_dir = b.get("isDir").and_then(|v| v.as_bool()).unwrap_or(false);
        match (a_dir, b_dir) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => {
                let an = a.get("name").and_then(|v| v.as_str()).unwrap_or("");
                let bn = b.get("name").and_then(|v| v.as_str()).unwrap_or("");
                an.cmp(bn)
            }
        }
    });
    Ok(json!({ "items": items }))
}

fn download_file(
    app: &AppHandle,
    id: &str,
    sftp: &ssh2::Sftp,
    remote: &str,
    local: &str,
    roots: &[PathBuf],
) -> Result<(), String> {
    assert_path_allowed(Path::new(local), roots, "sftp.pathErrors.localFileDenied")?;
    if let Some(parent) = Path::new(local).parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let mut remote_file = sftp.open(Path::new(remote)).map_err(|e| e.to_string())?;
    let mut local_file = std::fs::File::create(local).map_err(|e| e.to_string())?;
    let total = remote_file.stat().ok().and_then(|s| s.size).unwrap_or(0);
    let mut buf = [0u8; 65536];
    let mut transferred = 0u64;
    loop {
        let n = remote_file.read(&mut buf).map_err(|e| e.to_string())?;
        if n == 0 {
            break;
        }
        local_file.write_all(&buf[..n]).map_err(|e| e.to_string())?;
        transferred += n as u64;
        emit_progress(app, id, "download", transferred, total, remote);
    }
    Ok(())
}

fn upload_file(
    app: &AppHandle,
    id: &str,
    sftp: &ssh2::Sftp,
    local: &str,
    remote: &str,
    roots: &[PathBuf],
) -> Result<(), String> {
    assert_path_allowed(Path::new(local), roots, "sftp.pathErrors.localFileDenied")?;
    ensure_remote_parent_dirs(sftp, remote)?;
    let mut local_file = std::fs::File::open(local).map_err(|e| e.to_string())?;
    let total = local_file.metadata().map(|m| m.len()).unwrap_or(0);
    let mut remote_file = sftp
        .create(Path::new(remote))
        .map_err(|e| e.to_string())?;
    let mut buf = [0u8; 65536];
    let mut transferred = 0u64;
    loop {
        let n = local_file.read(&mut buf).map_err(|e| e.to_string())?;
        if n == 0 {
            break;
        }
        remote_file.write_all(&buf[..n]).map_err(|e| e.to_string())?;
        transferred += n as u64;
        emit_progress(app, id, "upload", transferred, total, local);
    }
    Ok(())
}

fn upload_bytes(
    app: &AppHandle,
    id: &str,
    sftp: &ssh2::Sftp,
    remote: &str,
    data: &[u8],
) -> Result<(), String> {
    ensure_remote_parent_dirs(sftp, remote)?;
    let total = data.len() as u64;
    let mut remote_file = sftp
        .create(Path::new(remote))
        .map_err(|e| e.to_string())?;
    const CHUNK: usize = 65536;
    let mut transferred = 0u64;
    for chunk in data.chunks(CHUNK) {
        remote_file.write_all(chunk).map_err(|e| e.to_string())?;
        transferred += chunk.len() as u64;
        emit_progress(app, id, "upload", transferred, total, remote);
    }
    Ok(())
}

/// Create remote parent directories for `remote` (best-effort; ignore already-exists).
fn ensure_remote_parent_dirs(sftp: &ssh2::Sftp, remote: &str) -> Result<(), String> {
    let remote = remote.replace('\\', "/");
    let parent = match remote.rsplit_once('/') {
        Some(("", _)) => return Ok(()), // "/file"
        Some((p, _)) if p.is_empty() => return Ok(()),
        Some((p, _)) => p.to_string(),
        None => return Ok(()),
    };
    if parent == "/" || parent.is_empty() {
        return Ok(());
    }
    let mut acc = String::new();
    for part in parent.split('/').filter(|s| !s.is_empty()) {
        acc.push('/');
        acc.push_str(part);
        // Existing dirs often return Failure/exists — ignore, matching frontend ensureRemoteDir.
        let _ = sftp.mkdir(Path::new(&acc), 0o755);
    }
    Ok(())
}

fn download_dir(
    app: &AppHandle,
    id: &str,
    sftp: &ssh2::Sftp,
    remote_dir: &str,
    local_dir: &str,
    roots: &[PathBuf],
) -> Result<(), String> {
    assert_path_allowed(Path::new(local_dir), roots, "sftp.pathErrors.localDirDenied")?;
    std::fs::create_dir_all(local_dir).map_err(|e| e.to_string())?;
    download_dir_rec(app, id, sftp, remote_dir, local_dir, roots)
}

fn download_dir_rec(
    app: &AppHandle,
    id: &str,
    sftp: &ssh2::Sftp,
    remote_dir: &str,
    local_dir: &str,
    roots: &[PathBuf],
) -> Result<(), String> {
    let entries = sftp
        .readdir(Path::new(remote_dir))
        .map_err(|e| e.to_string())?;
    for (path, stat) in entries {
        let name = path
            .file_name()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_default();
        if name == "." || name == ".." {
            continue;
        }
        let remote_child = path.to_string_lossy().to_string();
        let local_child = Path::new(local_dir).join(&name);
        if stat.is_dir() {
            std::fs::create_dir_all(&local_child).map_err(|e| e.to_string())?;
            download_dir_rec(
                app,
                id,
                sftp,
                &remote_child,
                &local_child.to_string_lossy(),
                roots,
            )?;
        } else {
            download_file(
                app,
                id,
                sftp,
                &remote_child,
                &local_child.to_string_lossy(),
                roots,
            )?;
        }
    }
    Ok(())
}

fn delete_path(sftp: &ssh2::Sftp, remote_path: &str) -> Result<(), String> {
    let path = Path::new(remote_path);
    let stat: FileStat = sftp.stat(path).map_err(|e| e.to_string())?;
    if stat.is_dir() {
        // recursive delete
        let entries = sftp.readdir(path).map_err(|e| e.to_string())?;
        for (p, st) in entries {
            let name = p.file_name().map(|s| s.to_string_lossy().to_string()).unwrap_or_default();
            if name == "." || name == ".." {
                continue;
            }
            delete_path(sftp, &p.to_string_lossy())?;
            let _ = st;
        }
        sftp.rmdir(path).map_err(|e| e.to_string())
    } else {
        sftp.unlink(path).map_err(|e| e.to_string())
    }
}

fn emit_progress(app: &AppHandle, id: &str, typ: &str, transferred: u64, total: u64, file: &str) {
    let percent = if total > 0 {
        ((transferred as f64 / total as f64) * 100.0).round() as u64
    } else {
        0
    };
    let _ = app.emit(
        "sftp:progress",
        (
            id.to_string(),
            json!({
                "type": typ,
                "transferred": transferred,
                "total": total,
                "percent": percent,
                "file": file,
            }),
        ),
    );
}

pub async fn request<T, F>(state: &AppState, id: &str, build: F) -> Result<T, String>
where
    T: Send + 'static,
    F: FnOnce(oneshot::Sender<Result<T, String>>) -> SftpCmd,
{
    let (tx, rx) = oneshot::channel();
    let cmd = build(tx);
    let Some(sess) = state.sftp.get(id) else {
        return Err("sftp.notConnected".into());
    };
    sess.cmd_tx
        .send(cmd)
        .map_err(|_| "sftp.notConnected".to_string())?;
    rx.await.map_err(|_| "sftp.notConnected".to_string())?
}

pub fn disconnect(state: &AppState, id: &str) {
    if let Some((_, sess)) = state.sftp.remove(id) {
        let _ = sess.cmd_tx.send(SftpCmd::Disconnect);
    }
}

#[allow(dead_code)]
fn _wire(s: &[u8]) -> String {
    buffer_to_binary_wire(s)
}
