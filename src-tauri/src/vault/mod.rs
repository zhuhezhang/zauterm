//! Credential vault with ChaCha20-Poly1305; master key in OS keyring

use chacha20poly1305::{
    aead::{Aead, KeyInit},
    ChaCha20Poly1305, Nonce,
};
use keyring::Entry;
use rand::RngCore;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

const SERVICE: &str = "zauterm";
const MASTER_KEY_ACCOUNT: &str = "vault-master-key-v1";
const VAULT_FILE: &str = "zauterm-credentials-vault.json";

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct VaultEntry {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub password: Option<String>,
    #[serde(rename = "privateKey", skip_serializing_if = "Option::is_none")]
    pub private_key: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub passphrase: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Vault {
    pub v: u32,
    pub entries: HashMap<String, VaultEntry>,
}

impl Default for Vault {
    fn default() -> Self {
        Self {
            v: 1,
            entries: HashMap::new(),
        }
    }
}

fn vault_path(app_data: &Path) -> PathBuf {
    app_data.join(VAULT_FILE)
}

fn get_or_create_master_key() -> Result<[u8; 32], String> {
    let entry = Entry::new(SERVICE, MASTER_KEY_ACCOUNT).map_err(|e| e.to_string())?;
    match entry.get_password() {
        Ok(pw) => {
            let bytes = base64::Engine::decode(&base64::engine::general_purpose::STANDARD, pw.trim())
                .map_err(|e| e.to_string())?;
            if bytes.len() != 32 {
                return Err("invalid master key length".into());
            }
            let mut key = [0u8; 32];
            key.copy_from_slice(&bytes);
            Ok(key)
        }
        Err(_) => {
            let mut key = [0u8; 32];
            rand::thread_rng().fill_bytes(&mut key);
            let b64 = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, key);
            entry.set_password(&b64).map_err(|e| e.to_string())?;
            Ok(key)
        }
    }
}

pub fn is_encryption_available() -> bool {
    get_or_create_master_key().is_ok()
}

fn encrypt_field(plain: &str) -> Result<String, String> {
    let key = get_or_create_master_key()?;
    let cipher = ChaCha20Poly1305::new_from_slice(&key).map_err(|e| e.to_string())?;
    let mut nonce_bytes = [0u8; 12];
    rand::thread_rng().fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);
    let ciphertext = cipher
        .encrypt(nonce, plain.as_bytes())
        .map_err(|e| e.to_string())?;
    let mut out = Vec::with_capacity(12 + ciphertext.len());
    out.extend_from_slice(&nonce_bytes);
    out.extend_from_slice(&ciphertext);
    Ok(base64::Engine::encode(
        &base64::engine::general_purpose::STANDARD,
        out,
    ))
}

fn decrypt_field(b64: &str) -> Result<String, String> {
    let key = get_or_create_master_key()?;
    let raw = base64::Engine::decode(&base64::engine::general_purpose::STANDARD, b64)
        .map_err(|e| e.to_string())?;
    if raw.len() < 13 {
        return Err("ciphertext too short".into());
    }
    let (nonce_bytes, ct) = raw.split_at(12);
    let cipher = ChaCha20Poly1305::new_from_slice(&key).map_err(|e| e.to_string())?;
    let nonce = Nonce::from_slice(nonce_bytes);
    let plain = cipher.decrypt(nonce, ct).map_err(|e| e.to_string())?;
    String::from_utf8(plain).map_err(|e| e.to_string())
}

pub fn read_vault(app_data: &Path) -> Vault {
    let path = vault_path(app_data);
    match fs::read_to_string(&path) {
        Ok(raw) => serde_json::from_str(&raw).unwrap_or_default(),
        Err(_) => Vault::default(),
    }
}

pub fn write_vault(app_data: &Path, vault: &Vault) -> Result<(), String> {
    fs::create_dir_all(app_data).map_err(|e| e.to_string())?;
    let path = vault_path(app_data);
    let tmp = path.with_extension("json.tmp");
    let data = serde_json::to_string_pretty(vault).map_err(|e| e.to_string())?;
    fs::write(&tmp, data).map_err(|e| e.to_string())?;
    fs::rename(&tmp, &path).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn get_secrets(app_data: &Path, saved_id: &str) -> serde_json::Value {
    if saved_id.is_empty() {
        return serde_json::json!({ "found": false, "reason": "invalidSavedId" });
    }
    if !is_encryption_available() {
        return serde_json::json!({ "found": false, "reason": "encryptionUnavailable" });
    }
    let vault = read_vault(app_data);
    let Some(enc) = vault.entries.get(saved_id) else {
        return serde_json::json!({ "found": false, "reason": "notInVault" });
    };
    let mut out = serde_json::Map::new();
    out.insert("found".into(), serde_json::Value::Bool(true));
    match try_decrypt_entry(enc) {
        Ok(plain) => {
            if let Some(p) = plain.password {
                out.insert("password".into(), serde_json::Value::String(p));
            }
            if let Some(p) = plain.private_key {
                out.insert("privateKey".into(), serde_json::Value::String(p));
            }
            if let Some(p) = plain.passphrase {
                out.insert("passphrase".into(), serde_json::Value::String(p));
            }
            serde_json::Value::Object(out)
        }
        Err(_) => serde_json::json!({ "found": false, "reason": "decryptFailed" }),
    }
}

fn try_decrypt_entry(enc: &VaultEntry) -> Result<VaultEntry, String> {
    Ok(VaultEntry {
        password: enc
            .password
            .as_ref()
            .map(|s| decrypt_field(s))
            .transpose()?,
        private_key: enc
            .private_key
            .as_ref()
            .map(|s| decrypt_field(s))
            .transpose()?,
        passphrase: enc
            .passphrase
            .as_ref()
            .map(|s| decrypt_field(s))
            .transpose()?,
    })
}

pub fn sync_secrets(
    app_data: &Path,
    saved_id: &str,
    partial: &serde_json::Value,
) -> Result<(), String> {
    if saved_id.is_empty() {
        return Err("credentials.invalidSavedId".into());
    }
    if !is_encryption_available() {
        return Err("credentials.encryptionUnavailable".into());
    }
    let mut vault = read_vault(app_data);
    let mut cur = vault.entries.get(saved_id).cloned().unwrap_or_default();
    for key in ["password", "privateKey", "passphrase"] {
        if let Some(v) = partial.get(key) {
            if v.is_null() || v.as_str() == Some("") {
                match key {
                    "password" => cur.password = None,
                    "privateKey" => cur.private_key = None,
                    "passphrase" => cur.passphrase = None,
                    _ => {}
                }
            } else if let Some(s) = v.as_str() {
                let enc = encrypt_field(s)?;
                match key {
                    "password" => cur.password = Some(enc),
                    "privateKey" => cur.private_key = Some(enc),
                    "passphrase" => cur.passphrase = Some(enc),
                    _ => {}
                }
            }
        }
    }
    if cur.password.is_none() && cur.private_key.is_none() && cur.passphrase.is_none() {
        vault.entries.remove(saved_id);
    } else {
        vault.entries.insert(saved_id.to_string(), cur);
    }
    write_vault(app_data, &vault)
}

pub fn remove_secrets(app_data: &Path, saved_id: &str) -> Result<(), String> {
    let mut vault = read_vault(app_data);
    vault.entries.remove(saved_id);
    write_vault(app_data, &vault)
}

pub fn duplicate_secrets(app_data: &Path, from_id: &str, to_id: &str) -> Result<(), String> {
    if from_id.is_empty() || to_id.is_empty() {
        return Err("credentials.invalidSavedId".into());
    }
    let mut vault = read_vault(app_data);
    if let Some(e) = vault.entries.get(from_id).cloned() {
        vault.entries.insert(to_id.to_string(), e);
        write_vault(app_data, &vault)?;
    }
    Ok(())
}

pub fn clear_all(app_data: &Path) -> Result<(), String> {
    let path = vault_path(app_data);
    if path.exists() {
        fs::remove_file(&path).map_err(|e| e.to_string())?;
    }
    Ok(())
}
