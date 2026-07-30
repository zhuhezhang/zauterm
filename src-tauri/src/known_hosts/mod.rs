//! SSH known hosts store + trust dialogs

use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tauri::{AppHandle, Manager};
use tauri_plugin_dialog::{DialogExt, MessageDialogKind};

const FILE: &str = "zterm-known-hosts.json";

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct KnownHostsFile {
    pub v: u32,
    pub hosts: HashMap<String, HostRecord>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HostRecord {
    pub fingerprint: String,
    #[serde(rename = "keyType", default)]
    pub key_type: String,
}

pub struct KnownHostsState {
    pub session_trust: Mutex<HashSet<String>>,
}

impl Default for KnownHostsState {
    fn default() -> Self {
        Self {
            session_trust: Mutex::new(HashSet::new()),
        }
    }
}

fn host_key(host: &str, port: u16) -> String {
    format!("{}:{}", host.to_lowercase(), port)
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

pub fn fingerprint_sha256(key: &[u8]) -> String {
    let hash = Sha256::digest(key);
    format!(
        "SHA256:{}",
        base64::Engine::encode(&base64::engine::general_purpose::STANDARD, hash)
            .trim_end_matches('=')
    )
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

/// Verify host key; returns Ok(true) if trusted, Ok(false) if rejected
pub async fn verify_host_key(
    app: &AppHandle,
    state: &Arc<KnownHostsState>,
    host: &str,
    port: u16,
    key: &[u8],
    key_type: &str,
) -> Result<bool, String> {
    let hk = host_key(host, port);
    let fp = fingerprint_sha256(key);

    if state.session_trust.lock().contains(&format!("{}|{}", hk, fp)) {
        return Ok(true);
    }

    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;
    let store = read_store(&app_data);

    if let Some(rec) = store.hosts.get(&hk) {
        if rec.fingerprint == fp {
            return Ok(true);
        }
        // changed
        let msg = format!(
            "Host key for {} has CHANGED!\n\nOld: {}\nNew: {}\n\nThis may indicate a MITM attack.\nAccept the new key?",
            hk, rec.fingerprint, fp
        );
        let accepted = ask_dialog(app, "SSH Host Key Changed", &msg).await;
        if accepted {
            save_host(&app_data, &hk, &fp, key_type)?;
            state.session_trust.lock().insert(format!("{}|{}", hk, fp));
            return Ok(true);
        }
        return Ok(false);
    }

    let msg = format!(
        "Unknown host: {}\n\nKey type: {}\nFingerprint:\n{}\n\nTrust this host?",
        hk, key_type, fp
    );
    let accepted = ask_dialog(app, "SSH Host Key Verification", &msg).await;
    if !accepted {
        return Ok(false);
    }
    // Ask save vs once via second dialog: Yes=save, No=once (simplified: always offer Save)
    let save = ask_dialog(
        app,
        "Save Host Key?",
        "Save this host key permanently?\n\nYes = Save\nNo = Trust once for this session",
    )
    .await;
    if save {
        save_host(&app_data, &hk, &fp, key_type)?;
    }
    state.session_trust.lock().insert(format!("{}|{}", hk, fp));
    Ok(true)
}

fn save_host(app_data: &Path, hk: &str, fp: &str, key_type: &str) -> Result<(), String> {
    let mut store = read_store(app_data);
    store.v = 1;
    store.hosts.insert(
        hk.to_string(),
        HostRecord {
            fingerprint: fp.to_string(),
            key_type: key_type.to_string(),
        },
    );
    write_store(app_data, &store)
}

async fn ask_dialog(app: &AppHandle, title: &str, message: &str) -> bool {
    let app = app.clone();
    let title = title.to_string();
    let message = message.to_string();
    tauri::async_runtime::spawn_blocking(move || {
        app.dialog()
            .message(format!("{message}\n\n[OK = Trust / Cancel = Reject]"))
            .title(&title)
            .kind(MessageDialogKind::Warning)
            .blocking_show()
    })
    .await
    .unwrap_or(false)
}
