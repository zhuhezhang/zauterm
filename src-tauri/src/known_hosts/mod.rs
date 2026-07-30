//! SSH known hosts store + trust dialogs (aligned with Electron sshKnownHosts)
//! 信任主机信息和主机密钥存储路径
//! mac 示例：/Users/zhuhezhang/Library/Application Support/per.zhuhezhang.zterm/*.json
//! windows 示例：C:\Users\zhuhezhang\AppData\Roaming\per.zhuhezhang.zterm\*.json
//! linux 示例：/home/zhuhezhang/.config/per.zhuhezhang.zterm/*.json

use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tauri::{AppHandle, Manager};
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind, MessageDialogResult};
use tokio::sync::Mutex as AsyncMutex;

const FILE: &str = "zterm-known-hosts.json";

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct KnownHostsFile {
    pub v: u32,
    pub hosts: HashMap<String, HostRecord>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HostRecord {
    /// SHA256 fingerprint (base64), matching Electron `sha256`
    pub fingerprint: String,
    #[serde(rename = "keyType", default)]
    pub key_type: String,
    #[serde(rename = "updatedAt", default)]
    pub updated_at: u64,
}

pub struct KnownHostsState {
    /// host:port → fingerprint (trust once for this app session)
    pub session_trust: Mutex<HashMap<String, String>>,
    /// Serialize concurrent prompts for the same host:port (SSH+SFTP)
    pending: Mutex<HashMap<String, Arc<AsyncMutex<()>>>>,
}

impl Default for KnownHostsState {
    fn default() -> Self {
        Self {
            session_trust: Mutex::new(HashMap::new()),
            pending: Mutex::new(HashMap::new()),
        }
    }
}

fn host_port_key(host: &str, port: u16) -> String {
    format!("{}:{}", host.trim().to_lowercase(), port)
}

fn store_path(app_data: &Path) -> PathBuf {
    app_data.join(FILE)
}

pub fn read_store(app_data: &Path) -> KnownHostsFile {
    match fs::read_to_string(store_path(app_data)) {
        Ok(raw) => serde_json::from_str(&raw).unwrap_or(KnownHostsFile {
            v: 1,
            hosts: HashMap::new(),
        }),
        Err(_) => KnownHostsFile {
            v: 1,
            hosts: HashMap::new(),
        },
    }
}

fn write_store(app_data: &Path, store: &KnownHostsFile) -> Result<(), String> {
    fs::create_dir_all(app_data).map_err(|e| e.to_string())?;
    let path = store_path(app_data);
    let tmp = path.with_extension("json.tmp");
    fs::write(&tmp, serde_json::to_string_pretty(store).unwrap()).map_err(|e| e.to_string())?;
    fs::rename(&tmp, &path).map_err(|e| e.to_string())?;
    Ok(())
}

/// SHA256 fingerprint as base64 (Electron-compatible, no `SHA256:` prefix)
pub fn fingerprint_sha256(key: &[u8]) -> String {
    let hash = Sha256::digest(key);
    base64::Engine::encode(&base64::engine::general_purpose::STANDARD, hash)
}

/// Normalize stored fingerprints for comparison (strip optional `SHA256:` / padding).
fn fp_key(fp: &str) -> String {
    fp.trim()
        .trim_start_matches("SHA256:")
        .trim_start_matches("sha256:")
        .trim_end_matches('=')
        .to_string()
}

fn fp_eq(a: &str, b: &str) -> bool {
    fp_key(a) == fp_key(b)
}

pub fn clear_known_hosts(app_data: &Path) -> Result<(), String> {
    let path = store_path(app_data);
    if path.exists() {
        fs::remove_file(path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub fn clear_session_cache(state: &KnownHostsState) {
    state.session_trust.lock().clear();
}

fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

fn normalize_key_type(raw: &str) -> String {
    let s = raw.trim();
    // ssh2 Debug often yields `SshEd25519` / `Rsa` etc.
    let lower = s.to_lowercase().replace('_', "-");
    match lower.as_str() {
        "sshed25519" | "ed25519" | "ssh-ed25519" => "ssh-ed25519".into(),
        "rsa" | "ssh-rsa" => "ssh-rsa".into(),
        "ecdsa" | "ecdsa-sha2-nistp256" => "ecdsa-sha2-nistp256".into(),
        "dss" | "ssh-dss" => "ssh-dss".into(),
        _ => {
            if s.starts_with("ssh-") || s.starts_with("ecdsa-") {
                s.to_string()
            } else {
                s.to_string()
            }
        }
    }
}

struct TrustCopy {
    zh: bool,
}

impl TrustCopy {
    fn from_lang(lang: &str) -> Self {
        Self {
            zh: !lang.to_lowercase().starts_with("en"),
        }
    }

    fn unknown_title(&self) -> &'static str {
        if self.zh {
            "未知 SSH 主机"
        } else {
            "Unknown SSH host"
        }
    }

    fn unknown_message(&self, hp: &str, key_type: &str, fp: &str) -> String {
        if self.zh {
            format!(
                "尚未记录该主机的公钥指纹，是否信任该主机？\n\n主机: {hp}\n密钥类型: {key_type}\nSHA256: {fp}"
            )
        } else {
            format!(
                "This host key is not in your saved fingerprints. Trust this host?\n\nHost: {hp}\nKey type: {key_type}\nSHA256: {fp}"
            )
        }
    }

    fn unknown_buttons(&self) -> (String, String, String) {
        // YesNoCancelCustom(yes, no, cancel) — map: trustSave / trustOnce / cancel
        if self.zh {
            (
                "信任并保存".into(),
                "仅信任一次".into(),
                "否".into(),
            )
        } else {
            (
                "Trust and save".into(),
                "Trust once".into(),
                "No".into(),
            )
        }
    }

    fn changed_title(&self) -> &'static str {
        if self.zh {
            "SSH 主机密钥已变更"
        } else {
            "SSH host key changed"
        }
    }

    fn changed_message(&self, hp: &str, key_type: &str, saved: &str, current: &str) -> String {
        if self.zh {
            format!(
                "与本地已保存的指纹不一致，可能存在中间人攻击，是否信任该主机？\n\n主机: {hp}\n密钥类型: {key_type}\n已保存 SHA256: {saved}\n当前 SHA256: {current}"
            )
        } else {
            format!(
                "The fingerprint does not match the saved record. This may indicate a man-in-the-middle attack. Trust this host?\n\nHost: {hp}\nKey type: {key_type}\nSaved SHA256: {saved}\nCurrent SHA256: {current}"
            )
        }
    }

    fn changed_buttons(&self) -> (String, String, String) {
        // yes = trust new & save, no = trust once, cancel = disconnect
        if self.zh {
            (
                "信任新密钥并保存".into(),
                "仅信任一次".into(),
                "否".into(),
            )
        } else {
            (
                "Trust new key and save".into(),
                "Trust once".into(),
                "No".into(),
            )
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum TrustChoice {
    Reject,
    Once,
    Save,
}

/// Verify host key; returns Ok(true) if trusted, Ok(false) if rejected.
/// Concurrent SSH+SFTP checks for the same host:port share one dialog.
pub async fn verify_host_key_with_lang(
    app: &AppHandle,
    state: &Arc<KnownHostsState>,
    host: &str,
    port: u16,
    key: &[u8],
    key_type: &str,
    lang: &str,
) -> Result<bool, String> {
    let hp = host_port_key(host, port);
    let fp = fingerprint_sha256(key);
    let key_type = normalize_key_type(key_type);

    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;

    // Disk → session (same order as Electron)
    {
        let store = read_store(&app_data);
        if let Some(rec) = store.hosts.get(&hp) {
            if fp_eq(&rec.fingerprint, &fp) {
                return Ok(true);
            }
        }
    }
    if already_trusted(state, &hp, &fp) {
        return Ok(true);
    }

    // One in-flight prompt per host:port (SSH and SFTP connect together)
    let gate = {
        let mut map = state.pending.lock();
        map.entry(hp.clone())
            .or_insert_with(|| Arc::new(AsyncMutex::new(())))
            .clone()
    };
    let _guard = gate.lock().await;
    // Ensure map entry is cleared when this verify finishes (success or early return)
    struct ClearPending<'a> {
        state: &'a KnownHostsState,
        hp: String,
    }
    impl Drop for ClearPending<'_> {
        fn drop(&mut self) {
            self.state.pending.lock().remove(&self.hp);
        }
    }
    let _clear = ClearPending {
        state,
        hp: hp.clone(),
    };

    // Re-check after waiting — another caller may have finished the prompt
    {
        let store = read_store(&app_data);
        if let Some(rec) = store.hosts.get(&hp) {
            if fp_eq(&rec.fingerprint, &fp) {
                return Ok(true);
            }
        }
    }
    if already_trusted(state, &hp, &fp) {
        return Ok(true);
    }

    let mut store = read_store(&app_data);
    let existing = store.hosts.get(&hp).cloned();
    // Treat matching fingerprint (after normalize) as already trusted
    if let Some(ref rec) = existing {
        if fp_eq(&rec.fingerprint, &fp) {
            return Ok(true);
        }
    }

    let copy = TrustCopy::from_lang(lang);
    let choice = if let Some(ref rec) = existing {
        prompt_three_way(
            app,
            copy.changed_title(),
            &copy.changed_message(&hp, &key_type, &rec.fingerprint, &fp),
            MessageDialogKind::Error,
            copy.changed_buttons(),
        )
        .await
    } else {
        prompt_three_way(
            app,
            copy.unknown_title(),
            &copy.unknown_message(&hp, &key_type, &fp),
            MessageDialogKind::Info,
            copy.unknown_buttons(),
        )
        .await
    };

    match choice {
        TrustChoice::Reject => Ok(false),
        TrustChoice::Once => {
            state.session_trust.lock().insert(hp, fp);
            Ok(true)
        }
        TrustChoice::Save => {
            store.v = 1;
            store.hosts.insert(
                hp.clone(),
                HostRecord {
                    fingerprint: fp.clone(),
                    key_type,
                    updated_at: now_ms(),
                },
            );
            write_store(&app_data, &store)?;
            state.session_trust.lock().remove(&hp);
            Ok(true)
        }
    }
}

fn already_trusted(state: &KnownHostsState, hp: &str, fp: &str) -> bool {
    state
        .session_trust
        .lock()
        .get(hp)
        .is_some_and(|saved| fp_eq(saved, fp))
}

async fn prompt_three_way(
    app: &AppHandle,
    title: &str,
    message: &str,
    kind: MessageDialogKind,
    buttons: (String, String, String),
) -> TrustChoice {
    let app = app.clone();
    let title = title.to_string();
    let message = message.to_string();
    let (yes_label, no_label, cancel_label) = buttons;
    let yes_match = yes_label.clone();
    let no_match = no_label.clone();

    let result = tauri::async_runtime::spawn_blocking(move || {
        app.dialog()
            .message(&message)
            .title(&title)
            .kind(kind)
            .buttons(MessageDialogButtons::YesNoCancelCustom(
                yes_label,
                no_label,
                cancel_label,
            ))
            .blocking_show_with_result()
    })
    .await
    .unwrap_or(MessageDialogResult::Cancel);

    match result {
        MessageDialogResult::Yes => TrustChoice::Save,
        MessageDialogResult::No => TrustChoice::Once,
        MessageDialogResult::Custom(ref s) if *s == yes_match => TrustChoice::Save,
        MessageDialogResult::Custom(ref s) if *s == no_match => TrustChoice::Once,
        MessageDialogResult::Ok => TrustChoice::Save,
        _ => TrustChoice::Reject,
    }
}
