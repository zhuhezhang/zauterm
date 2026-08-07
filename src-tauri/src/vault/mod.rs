//! 凭证库采用ChaCha20-Poly1305；操作系统密钥环中的主密钥

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
use std::sync::Mutex;

/// 凭证库服务名称
const SERVICE: &str = "zauterm";
/// 主密钥账户名称
const MASTER_KEY_ACCOUNT: &str = "vault-master-key-v1";
/// 凭证库文件名称
const VAULT_FILE: &str = "zauterm-credentials-vault.json";
/// 可选的测试主密钥覆盖（避免在单元测试中使用操作系统密钥环）
static TEST_MASTER_KEY: Mutex<Option<[u8; 32]>> = Mutex::new(None);

/// 凭证库条目
#[derive(Debug, Clone, Serialize, Deserialize, Default)]  // 为结构体或枚举自动生成常用 trait 的实现（如 Debug、Clone、Copy 等）
pub struct VaultEntry {
    /// 密码
    #[serde(skip_serializing_if = "Option::is_none")]  // 如果 Option 为 None，则不进行序列化
    pub password: Option<String>,
    /// 私钥
    #[serde(rename = "privateKey", skip_serializing_if = "Option::is_none")]  // 如果 Option 为 None，则不进行序列化，并重命名为 privateKey
    pub private_key: Option<String>,
    /// 私钥密码
    #[serde(skip_serializing_if = "Option::is_none")]  // 如果 Option 为 None，则不进行序列化
    pub passphrase: Option<String>,
}

/// 凭证库
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Vault {
    /// 版本
    pub v: u32,
    /// 条目
    pub entries: HashMap<String, VaultEntry>,
}

impl Default for Vault {
    /// 默认实现
    fn default() -> Self {
        // 返回一个默认的凭证库
        Self {
            v: 1,
            entries: HashMap::new(),
        }
    }
}

/// 获取凭证库文件路径
/// # 参数
/// - app_data: 应用程序数据目录
/// # 返回
/// 凭证库文件路径
fn vault_path(app_data: &Path) -> PathBuf {
    // 将 app_data 和 VAULT_FILE 拼接成一个 PathBuf
    app_data.join(VAULT_FILE)
}

/// 获取或创建主密钥
/// # 返回
/// 主密钥
fn get_or_create_master_key() -> Result<[u8; 32], String> {
    if let Ok(guard) = TEST_MASTER_KEY.lock() {  // 如果测试主密钥覆盖存在，则返回测试主密钥；否则，获取主密钥
        if let Some(k) = *guard {
            return Ok(k);
        }
    }

    let entry = Entry::new(SERVICE, MASTER_KEY_ACCOUNT).map_err(|e| e.to_string())?;  // 创建一个操作系统密钥环条目
    match entry.get_password() {
        Ok(pw) => {
            let bytes = base64::Engine::decode(&base64::engine::general_purpose::STANDARD, pw.trim())
                .map_err(|e| e.to_string())?;
            if bytes.len() != 32 {
                return Err("invalid master key length".into());  // 如果主密钥长度不正确，则返回错误
            }
            let mut key = [0u8; 32];
            key.copy_from_slice(&bytes);
            Ok(key)  // 返回主密钥
        }
        Err(_) => {
            let mut key = [0u8; 32];  // 生成一个随机的32字节主密钥
            rand::thread_rng().fill_bytes(&mut key);
            let b64 = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, key);  // 将主密钥编码为Base64
            entry.set_password(&b64).map_err(|e| e.to_string())?;  // 将主密钥设置到操作系统密钥环中
            Ok(key)
        }
    }
}

/// 检查加密是否可用
/// # 返回
/// 加密是否可用
pub fn is_encryption_available() -> bool {
    // 检查主密钥是否可用
    get_or_create_master_key().is_ok()
}

/// 加密字段
/// # 参数
/// - key: 主密钥
/// - plain: 明文
/// # 返回
/// 加密后的字段
fn encrypt_field_with_key(key: &[u8; 32], plain: &str) -> Result<String, String> {
    let cipher = ChaCha20Poly1305::new_from_slice(key).map_err(|e| e.to_string())?;  // 创建一个ChaCha20Poly1305加密器
    let mut nonce_bytes = [0u8; 12];  // 生成一个随机的12字节非重复字节数组
    rand::thread_rng().fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);
    let ciphertext = cipher
        .encrypt(nonce, plain.as_bytes())
        .map_err(|e| e.to_string())?;
    let mut out = Vec::with_capacity(12 + ciphertext.len());
    out.extend_from_slice(&nonce_bytes);
    out.extend_from_slice(&ciphertext);
    Ok(base64::Engine::encode(  // 将加密后的字段编码为Base64
        &base64::engine::general_purpose::STANDARD,
        out,
    ))
}

/// 解密字段
/// # 参数
/// - key: 主密钥
/// - b64: 加密后的字段
/// # 返回
/// 解密后的字段
fn decrypt_field_with_key(key: &[u8; 32], b64: &str) -> Result<String, String> {
    let raw = base64::Engine::decode(&base64::engine::general_purpose::STANDARD, b64)
        .map_err(|e| e.to_string())?;
    if raw.len() < 13 {
        return Err("ciphertext too short".into());  // 如果加密后的字段长度小于13，则返回错误
    }
    let (nonce_bytes, ct) = raw.split_at(12);
    let cipher = ChaCha20Poly1305::new_from_slice(key).map_err(|e| e.to_string())?;  // 创建一个ChaCha20Poly1305解密器
    let nonce = Nonce::from_slice(nonce_bytes);
    let plain = cipher.decrypt(nonce, ct).map_err(|e| e.to_string())?;  // 解密字段
    String::from_utf8(plain).map_err(|e| e.to_string())
}

/// 加密字段
/// # 参数
/// - plain: 明文
/// # 返回
/// 加密后的字段
fn encrypt_field(plain: &str) -> Result<String, String> {
    let key = get_or_create_master_key()?;
    encrypt_field_with_key(&key, plain)
}

/// 解密字段
/// # 参数
/// - b64: 加密后的字段
/// # 返回
/// 解密后的字段
fn decrypt_field(b64: &str) -> Result<String, String> {
    let key = get_or_create_master_key()?;
    decrypt_field_with_key(&key, b64)
}

/// 读取凭证库
/// # 参数
/// - app_data: 应用程序数据目录
/// # 返回
/// 凭证库
pub fn read_vault(app_data: &Path) -> Vault {
    let path = vault_path(app_data);
    match fs::read_to_string(&path) {
        Ok(raw) => serde_json::from_str(&raw).unwrap_or_default(),  // 将凭证库文件内容解析为Vault结构体
        Err(_) => Vault::default(),
    }
}

/// 写入凭证库
/// # 参数
/// - app_data: 应用程序数据目录
/// - vault: 凭证库
/// # 返回
/// 结果
pub fn write_vault(app_data: &Path, vault: &Vault) -> Result<(), String> {
    fs::create_dir_all(app_data).map_err(|e| e.to_string())?;  // 创建应用程序数据目录
    let path = vault_path(app_data);  // 获取凭证库文件路径
    let tmp = path.with_extension("json.tmp");  // 获取临时文件路径
    let data = serde_json::to_string_pretty(vault).map_err(|e| e.to_string())?;  // 将凭证库序列化为JSON字符串
    fs::write(&tmp, data).map_err(|e| e.to_string())?;  // 将凭证库写入临时文件
    fs::rename(&tmp, &path).map_err(|e| e.to_string())?;  // 将临时文件重命名为凭证库文件
    Ok(())
}

/// 获取凭证
/// # 参数
/// - app_data: 应用程序数据目录
/// - saved_id: 凭证ID
/// # 返回
/// 凭证
pub fn get_secrets(app_data: &Path, saved_id: &str) -> serde_json::Value {
    if saved_id.is_empty() {
        return serde_json::json!({ "found": false, "reason": "invalidSavedId" });  // 如果凭证ID为空，则返回错误
    }
    if !is_encryption_available() {
        return serde_json::json!({ "found": false, "reason": "encryptionUnavailable" });  // 如果加密不可用，则返回错误
    }
    let vault = read_vault(app_data);
    let Some(enc) = vault.entries.get(saved_id) else {
        return serde_json::json!({ "found": false, "reason": "notInVault" });  // 如果凭证不存在，则返回错误
    };
    let mut out = serde_json::Map::new();
    out.insert("found".into(), serde_json::Value::Bool(true));  // 添加凭证是否找到标志
    match try_decrypt_entry(enc) {
        Ok(plain) => {
            if let Some(p) = plain.password {
                out.insert("password".into(), serde_json::Value::String(p));  // 添加密码
            }
            if let Some(p) = plain.private_key {
                out.insert("privateKey".into(), serde_json::Value::String(p));  // 添加私钥
            }
            if let Some(p) = plain.passphrase {
                out.insert("passphrase".into(), serde_json::Value::String(p));  // 添加私钥密码
            }
            serde_json::Value::Object(out)  // 返回凭证
        }
        Err(_) => serde_json::json!({ "found": false, "reason": "decryptFailed" }),  // 如果解密失败，则返回错误
    }
}

/// 尝试解密凭证
/// # 参数
/// - enc: 加密的凭证
/// # 返回
/// 解密后的凭证
fn try_decrypt_entry(enc: &VaultEntry) -> Result<VaultEntry, String> {
    Ok(VaultEntry {  // 返回解密后的凭证
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

/// 同步凭证
/// # 参数
/// - app_data: 应用程序数据目录
/// - saved_id: 凭证ID
/// - partial: 部分凭证
/// # 返回
/// 结果
pub fn sync_secrets(
    app_data: &Path,
    saved_id: &str,
    partial: &serde_json::Value,
) -> Result<(), String> {
    if saved_id.is_empty() {
        return Err("credentials.invalidSavedId".into());  // 如果凭证ID为空，则返回错误
    }
    if !is_encryption_available() {
        return Err("credentials.encryptionUnavailable".into());  // 如果加密不可用，则返回错误
    }
    let mut vault = read_vault(app_data);
    let mut cur = vault.entries.get(saved_id).cloned().unwrap_or_default();  // 获取凭证
    for key in ["password", "privateKey", "passphrase"] {
        if let Some(v) = partial.get(key) {  // 获取部分凭证
            if v.is_null() || v.as_str() == Some("") {
                match key {  // 根据键名删除凭证
                    "password" => cur.password = None,
                    "privateKey" => cur.private_key = None,
                    "passphrase" => cur.passphrase = None,
                    _ => {}
                }
            } else if let Some(s) = v.as_str() {
                let enc = encrypt_field(s)?;  // 加密凭证
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
        vault.entries.remove(saved_id);  // 删除凭证
    } else {
        vault.entries.insert(saved_id.to_string(), cur);  // 插入凭证
    }
    write_vault(app_data, &vault)  // 写入凭证库
}

/// 删除凭证
/// # 参数
/// - app_data: 应用程序数据目录
/// - saved_id: 凭证ID
/// # 返回
/// 结果
pub fn remove_secrets(app_data: &Path, saved_id: &str) -> Result<(), String> {
    let mut vault = read_vault(app_data);
    vault.entries.remove(saved_id);  // 删除凭证
    write_vault(app_data, &vault)
}

/// 复制凭证
/// # 参数
/// - app_data: 应用程序数据目录
/// - from_id: 源凭证ID
/// - to_id: 目标凭证ID
/// # 返回
/// 结果
pub fn duplicate_secrets(app_data: &Path, from_id: &str, to_id: &str) -> Result<(), String> {
    if from_id.is_empty() || to_id.is_empty() {
        return Err("credentials.invalidSavedId".into());  // 如果凭证ID为空，则返回错误
    }
    let mut vault = read_vault(app_data);
    if let Some(e) = vault.entries.get(from_id).cloned() {  // 获取源凭证
        vault.entries.insert(to_id.to_string(), e);  // 插入目标凭证
        write_vault(app_data, &vault)?;
    }
    Ok(())
}

/// 清空所有凭证
/// # 参数
/// - app_data: 应用程序数据目录
/// # 返回
/// 结果
pub fn clear_all(app_data: &Path) -> Result<(), String> {
    let path = vault_path(app_data);  // 获取凭证库文件路径
    if path.exists() {
        fs::remove_file(&path).map_err(|e| e.to_string())?;  // 删除凭证库文件
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::MutexGuard;
    use std::time::{SystemTime, UNIX_EPOCH};

    /// 串行化依赖 TEST_MASTER_KEY 的用例，避免并行 Drop 清空密钥导致竞态
    static TEST_KEY_LOCK: Mutex<()> = Mutex::new(());

    /// 测试主密钥覆盖（持有锁直至用例结束）
    struct TestKeyGuard {
        _lock: MutexGuard<'static, ()>,
    }

    impl Drop for TestKeyGuard {
        /// 清空测试主密钥；字段 Drop 随后释放 TEST_KEY_LOCK
        fn drop(&mut self) {
            if let Ok(mut g) = TEST_MASTER_KEY.lock() {
                *g = None;
            }
        }
    }

    /// 设置测试主密钥
    /// # 返回
    /// 测试主密钥守卫（含全局串行锁）
    fn with_test_key() -> TestKeyGuard {
        let lock = TEST_KEY_LOCK.lock().unwrap();
        let mut key = [0u8; 32];  // 生成一个固定的32字节主密钥
        key[0] = 7;
        key[31] = 9;
        *TEST_MASTER_KEY.lock().unwrap() = Some(key);
        TestKeyGuard { _lock: lock }
    }

    /// 生成一个唯一的临时目录
    /// # 参数
    /// - label: 标签
    /// # 返回
    /// 唯一的临时目录
    fn unique_temp_dir(label: &str) -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0);
        let dir = std::env::temp_dir().join(format!(
            "zauterm-vault-{}-{}-{}",
            label,
            std::process::id(),
            nanos
        ));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    /// 测试加密解密
    #[test]
    fn encrypt_decrypt_roundtrip() {
        let key = [3u8; 32];
        let ct = encrypt_field_with_key(&key, "secret-pass").unwrap();
        assert_ne!(ct, "secret-pass");
        assert_eq!(decrypt_field_with_key(&key, &ct).unwrap(), "secret-pass");
    }

    /// 测试解密拒绝篡改的密文
    #[test]
    fn decrypt_rejects_tampered_ciphertext() {
        let key = [1u8; 32];  // 生成一个随机的32字节主密钥
        let ct = encrypt_field_with_key(&key, "x").unwrap();
        let mut bytes = ct.into_bytes();
        if let Some(b) = bytes.last_mut() {
            *b = if *b == b'A' { b'B' } else { b'A' };
        }
        let tampered = String::from_utf8(bytes).unwrap();
        assert!(decrypt_field_with_key(&key, &tampered).is_err());
    }

    /// 测试同步、获取、复制、删除、清空
    #[test]
    fn sync_get_duplicate_remove_clear() {
        let _guard = with_test_key();
        let dir = unique_temp_dir("round");  // 生成一个唯一的临时目录

        sync_secrets(
            &dir,
            "sess-1",
            &serde_json::json!({
                "password": "p@ss",
                "privateKey": "-----BEGIN KEY-----\nA\n-----END KEY-----",
                "passphrase": "ph"
            }),
        )
        .unwrap();

        let got = get_secrets(&dir, "sess-1");
        assert_eq!(got["found"], true, "get_secrets failed: {got}");
        assert_eq!(got["password"], "p@ss");
        assert_eq!(got["passphrase"], "ph");
        assert!(got["privateKey"].as_str().unwrap().contains("BEGIN KEY"));

        // 磁盘上的密文必须不包含明文密码
        let raw = fs::read_to_string(vault_path(&dir)).unwrap();
        assert!(!raw.contains("p@ss"));  // 确保磁盘上的密文不包含明文密码

        duplicate_secrets(&dir, "sess-1", "sess-2").unwrap();
        assert_eq!(get_secrets(&dir, "sess-2")["password"], "p@ss");  // 确保复制后的凭证包含密码

        remove_secrets(&dir, "sess-1").unwrap();
        assert_eq!(get_secrets(&dir, "sess-1")["found"], false);  // 确保删除后的凭证不存在
        assert_eq!(get_secrets(&dir, "sess-1")["reason"], "notInVault");

        clear_all(&dir).unwrap();
        assert!(!vault_path(&dir).exists());  // 确保清空后的凭证库不存在
        let _ = fs::remove_dir_all(&dir);
    }

    /// 测试同步拒绝空凭证ID
    #[test]
    fn sync_rejects_empty_saved_id() {
        let _guard = with_test_key();
        let err = sync_secrets(&std::env::temp_dir(), "", &serde_json::json!({})).unwrap_err();
        assert_eq!(err, "credentials.invalidSavedId");  // 确保同步拒绝空凭证ID
    }

    /// 测试清空所有字段删除凭证
    #[test]
    fn clearing_all_fields_removes_entry() {
        let _guard = with_test_key();
        let dir = unique_temp_dir("clear-fields");  // 生成一个唯一的临时目录
        sync_secrets(&dir, "a", &serde_json::json!({ "password": "x" })).unwrap();  // 同步凭证
        sync_secrets(&dir, "a", &serde_json::json!({ "password": "" })).unwrap();  // 同步凭证
        assert_eq!(get_secrets(&dir, "a")["reason"], "notInVault");  // 确保凭证不存在
        let _ = fs::remove_dir_all(&dir);  // 删除临时目录
    }
}
