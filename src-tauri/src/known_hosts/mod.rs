//! SSH 已知主机存储 + 信任对话框 (与 Electron sshKnownHosts 对齐)
//! 信任主机信息和主机密钥存储路径
//! mac 示例：/Users/zhuhezhang/Library/Application Support/zauterm/*.json
//! windows 示例：C:\Users\zhuhezhang\AppData\Roaming\zauterm\*.json
//! linux 示例：/home/zhuhezhang/.config/zauterm/*.json

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

/// 文件名
const FILE: &str = "zauterm-known-hosts.json";

/// 已知主机文件
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct KnownHostsFile {
    /// 版本
    pub v: u32,
    /// 主机记录
    pub hosts: HashMap<String, HostRecord>,
}

/// 主机记录
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HostRecord {
    /// SHA256 指纹 (base64), 匹配 Electron `sha256`
    pub fingerprint: String,
    /// 密钥类型
    #[serde(rename = "keyType", default)]
    pub key_type: String,
    /// 更新时间
    #[serde(rename = "updatedAt", default)]
    pub updated_at: u64,
}

/// 已知主机状态
pub struct KnownHostsState {
    /// host:port → fingerprint (信任一次用于此应用程序会话)
    pub session_trust: Mutex<HashMap<String, String>>,
    /// 序列化并发提示相同的 host:port (SSH+SFTP)
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

/// 主机端口键
/// # 参数
/// - host: 主机
/// - port: 端口
/// # 返回
/// 一个包含 String 的主机端口键
fn host_port_key(host: &str, port: u16) -> String {
    format!("{}:{}", host.trim().to_lowercase(), port)
}

/// 存储路径
/// # 参数
/// - app_data: 应用程序数据
/// # 返回
/// 一个包含 PathBuf 的存储路径
fn store_path(app_data: &Path) -> PathBuf {
    app_data.join(FILE)
}

/// 读取存储
/// # 参数
/// - app_data: 应用程序数据
/// # 返回
/// 一个包含 KnownHostsFile 的存储
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

/// 写入存储
/// # 参数
/// - app_data: 应用程序数据
/// - store: 存储
/// # 返回
/// 一个包含 Result<(), String> 的错误结果，如果成功则返回 Ok(())，否则返回 Err(String)
fn write_store(app_data: &Path, store: &KnownHostsFile) -> Result<(), String> {
    fs::create_dir_all(app_data).map_err(|e| e.to_string())?;
    let path = store_path(app_data);
    let tmp = path.with_extension("json.tmp");
    let data = serde_json::to_string_pretty(store).map_err(|e| e.to_string())?;
    fs::write(&tmp, data).map_err(|e| e.to_string())?;
    fs::rename(&tmp, &path).map_err(|e| e.to_string())?;
    Ok(())
}

/// SHA256 指纹 as base64 (Electron-兼容，没有 `SHA256:` 前缀)
/// # 参数
/// - key: 密钥
/// # 返回
/// 一个包含 String 的 SHA256 指纹
pub fn fingerprint_sha256(key: &[u8]) -> String {
    let hash = Sha256::digest(key);
    base64::Engine::encode(&base64::engine::general_purpose::STANDARD, hash)
}

/// 规范化存储指纹用于比较 (去除可选的 `SHA256:` / 填充)
/// # 参数
/// - fp: 指纹
/// # 返回
/// 一个包含 String 的规范化指纹
fn fp_key(fp: &str) -> String {
    fp.trim()
        .trim_start_matches("SHA256:")
        .trim_start_matches("sha256:")
        .trim_end_matches('=')
        .to_string()
}

/// 指纹相等
/// # 参数
/// - a: 指纹
/// - b: 指纹
/// # 返回
/// 一个包含 bool 的指纹相等
fn fp_eq(a: &str, b: &str) -> bool {
    fp_key(a) == fp_key(b)
}

/// 清除已知主机
/// # 参数
/// - app_data: 应用程序数据
/// # 返回
/// 一个包含 Result<(), String> 的错误结果，如果成功则返回 Ok(())，否则返回 Err(String)
pub fn clear_known_hosts(app_data: &Path) -> Result<(), String> {
    let path = store_path(app_data);
    if path.exists() {
        fs::remove_file(path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// 清除会话缓存
/// # 参数
/// - state: 已知主机状态
pub fn clear_session_cache(state: &KnownHostsState) {
    state.session_trust.lock().clear();
}

/// 当前时间毫秒
/// # 返回
/// 一个包含 u64 的当前时间毫秒
fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

/// 规范化密钥类型
/// # 参数
/// - raw: 原始密钥类型
/// # 返回
/// 一个包含 String 的规范化密钥类型
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

/// 信任复制
struct TrustCopy {
    /// 中文
    zh: bool,
}

impl TrustCopy {
    /// 从语言创建信任复制
    /// # 参数
    /// - lang: 语言
    /// # 返回
    /// 一个包含 TrustCopy 的信任复制
    fn from_lang(lang: &str) -> Self {
        Self {
            zh: !lang.to_lowercase().starts_with("en"),
        }
    }

    /// 未知标题
    /// # 返回
    /// 一个包含 &'static str 的未知标题
    fn unknown_title(&self) -> &'static str {
        if self.zh {
            "未知 SSH 主机"
        } else {
            "Unknown SSH host"
        }
    }

    /// 未知消息
    /// # 参数
    /// - hp: 主机端口
    /// - key_type: 密钥类型
    /// - fp: 指纹
    /// # 返回
    /// 一个包含 String 的未知消息
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

    /// 未知按钮
    /// # 返回
    /// 一个包含 (String, String, String) 的未知按钮
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

    /// 变更标题
    /// # 返回
    /// 一个包含 &'static str 的变更标题
    fn changed_title(&self) -> &'static str {
        if self.zh {
            "SSH 主机密钥已变更"
        } else {
            "SSH host key changed"
        }
    }

    /// 变更消息
    /// # 参数
    /// - hp: 主机端口
    /// - key_type: 密钥类型
    /// - saved: 已保存指纹
    /// - current: 当前指纹
    /// # 返回
    /// 一个包含 String 的变更消息
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

    /// 变更按钮
    /// # 返回
    /// 一个包含 (String, String, String) 的变更按钮
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

/// 信任选择
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum TrustChoice {
    /// 拒绝
    Reject,
    /// 信任一次
    Once,
    /// 保存
    Save,
}

/// 验证主机密钥; 如果信任则返回 Ok(true)，如果拒绝则返回 Ok(false)
/// # 参数
/// - app: 应用程序句柄
/// - state: 已知主机状态
/// - host: 主机
/// - port: 端口
/// - key: 密钥
/// - key_type: 密钥类型
/// - lang: 语言
/// # 返回
/// 一个包含 Result<bool, String> 的错误结果，如果信任则返回 Ok(true)，如果拒绝则返回 Ok(false)
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

    // 磁盘 → 会话 (与 Electron 相同顺序)
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

    // 每个主机端口一个正在进行的提示 (SSH 和 SFTP 一起连接)
    let gate = {
        let mut map = state.pending.lock();
        map.entry(hp.clone())
            .or_insert_with(|| Arc::new(AsyncMutex::new(())))
            .clone()
    };
    let _guard = gate.lock().await;
    // 确保当此验证完成时 map 条目被清除 (成功或早期返回)
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

    // 重新检查等待 — 另一个调用者可能已经完成了提示
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
    // 将匹配指纹 (规范化后) 视为已信任
    if let Some(ref rec) = existing {
        if fp_eq(&rec.fingerprint, &fp) {
            return Ok(true);
        }
    }

    // 创建信任复制。两边统一 Warning + 挂主窗口，避免 macOS 上 Info/Error 系统弹窗位置不一致。
    let copy = TrustCopy::from_lang(lang);
    let choice = if let Some(ref rec) = existing {
        prompt_three_way(
            app,
            copy.changed_title(),
            &copy.changed_message(&hp, &key_type, &rec.fingerprint, &fp),
            copy.changed_buttons(),
        )
        .await
    } else {
        prompt_three_way(
            app,
            copy.unknown_title(),
            &copy.unknown_message(&hp, &key_type, &fp),
            copy.unknown_buttons(),
        )
        .await
    };

    match choice {  // 匹配信任选择
        TrustChoice::Reject => Ok(false),  // 拒绝返回 false
        TrustChoice::Once => {  // 信任一次
            state.session_trust.lock().insert(hp, fp);
            Ok(true)  // 返回 true
        }
        TrustChoice::Save => {  // 信任并保存
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

/// 已经信任
/// # 参数
/// - state: 已知主机状态
/// - hp: 主机端口
/// - fp: 指纹
/// # 返回
/// 一个包含 bool 的已经信任
fn already_trusted(state: &KnownHostsState, hp: &str, fp: &str) -> bool {
    state
        .session_trust
        .lock()
        .get(hp)
        .is_some_and(|saved| fp_eq(saved, fp))
}

/// 提示三种方式
/// # 参数
/// - app: 应用程序句柄
/// - title: 标题
/// - message: 消息
/// - buttons: 按钮
/// # 返回
/// 一个包含 TrustChoice 的提示三种方式
async fn prompt_three_way(
    app: &AppHandle,
    title: &str,
    message: &str,
    buttons: (String, String, String),
) -> TrustChoice {
    let app = app.clone();  // 克隆应用程序句柄
    let title = title.to_string();  // 转换标题为字符串
    let message = message.to_string();  // 转换消息为字符串
    let (yes_label, no_label, cancel_label) = buttons;  // 解构按钮
    let yes_match = yes_label.clone();  // 克隆 yes 标签
    let no_match = no_label.clone();  // 克隆 no 标签

    let result = tauri::async_runtime::spawn_blocking(move || {  // 异步运行时启动阻塞
        let mut builder = app
            .dialog()
            .message(&message)
            .title(&title)
            .kind(MessageDialogKind::Warning)
            .buttons(MessageDialogButtons::YesNoCancelCustom(
                yes_label,
                no_label,
                cancel_label,
            ));
        if let Some(win) = app.get_webview_window("main") {
            builder = builder.parent(&win);
        }
        builder.blocking_show_with_result()
    })
    .await
    .unwrap_or(MessageDialogResult::Cancel);

    match result {
        MessageDialogResult::Yes => TrustChoice::Save,
        MessageDialogResult::No => TrustChoice::Once,  // 信任一次
        MessageDialogResult::Custom(ref s) if *s == yes_match => TrustChoice::Save,
        MessageDialogResult::Custom(ref s) if *s == no_match => TrustChoice::Once,
        MessageDialogResult::Ok => TrustChoice::Save,
        _ => TrustChoice::Reject,  // 拒绝
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    /// 唯一临时目录
    /// # 参数
    /// - label: 标签
    /// # 返回
    /// 一个包含 PathBuf 的唯一临时目录
    fn unique_temp_dir(label: &str) -> PathBuf {
        // 获取当前时间纳秒
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0);
        let dir = std::env::temp_dir().join(format!(  // 拼接临时目录
            "zauterm-known-hosts-{}-{}-{}",
            label,
            std::process::id(),  // 获取进程 ID
            nanos
        ));
        fs::create_dir_all(&dir).unwrap();  // 创建临时目录
        dir
    }

    /// 测试 SHA256 指纹 as base64 是稳定的
    #[test]
    fn fingerprint_sha256_is_stable_base64() {
        let a = fingerprint_sha256(b"host-key-bytes");
        let b = fingerprint_sha256(b"host-key-bytes");
        assert_eq!(a, b);
        assert!(!a.is_empty());
        // Different input → different fingerprint
        assert_ne!(a, fingerprint_sha256(b"other-key"));
    }

    /// 测试指纹相等
    #[test]
    fn fp_eq_strips_prefix_and_padding() {
        let raw = fingerprint_sha256(b"abc");
        assert!(fp_eq(&raw, &raw));
        assert!(fp_eq(&format!("SHA256:{raw}"), &raw));
        assert!(fp_eq(&format!("sha256:{raw}"), &raw));
        let trimmed = raw.trim_end_matches('=');
        assert!(fp_eq(trimmed, &raw));
        assert!(!fp_eq(&raw, "different"));
    }

    /// 测试主机端口键规范化
    #[test]
    fn host_port_key_normalizes() {
        assert_eq!(host_port_key("Example.COM", 22), "example.com:22");
        assert_eq!(host_port_key("  Host  ", 2222), "host:2222");
    }

    /// 测试密钥类型规范化
    #[test]
    fn normalize_key_type_maps_common_aliases() {
        assert_eq!(normalize_key_type("SshEd25519"), "ssh-ed25519");
        assert_eq!(normalize_key_type("ed25519"), "ssh-ed25519");
        assert_eq!(normalize_key_type("RSA"), "ssh-rsa");
        assert_eq!(normalize_key_type("ecdsa"), "ecdsa-sha2-nistp256");
        assert_eq!(normalize_key_type("ssh-rsa"), "ssh-rsa");
    }

    /// 测试存储往返和清除
    #[test]
    fn store_roundtrip_and_clear() {
        let dir = unique_temp_dir("store");
        let mut store = KnownHostsFile {
            v: 1,
            hosts: HashMap::new(),
        };
        store.hosts.insert(
            "h:22".into(),
            HostRecord {
                fingerprint: "abc=".into(),
                key_type: "ssh-ed25519".into(),
                updated_at: 1,
            },
        );
        write_store(&dir, &store).unwrap();
        let loaded = read_store(&dir);
        assert_eq!(loaded.v, 1);
        assert_eq!(loaded.hosts.get("h:22").unwrap().fingerprint, "abc=");
        clear_known_hosts(&dir).unwrap();
        assert!(!store_path(&dir).exists());
        let empty = read_store(&dir);
        assert!(empty.hosts.is_empty());
        let _ = fs::remove_dir_all(&dir);
    }

    /// 测试会话信任和清除缓存
    #[test]
    fn session_trust_and_clear_cache() {
        let state = KnownHostsState::default();
        state
            .session_trust
            .lock()
            .insert("h:22".into(), fingerprint_sha256(b"k"));
        let fp = fingerprint_sha256(b"k");
        assert!(already_trusted(&state, "h:22", &fp));
        assert!(!already_trusted(&state, "h:22", "nope"));
        clear_session_cache(&state);
        assert!(!already_trusted(&state, "h:22", &fp));
    }
}
