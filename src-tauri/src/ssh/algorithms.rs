//! SSH 算法偏好解析与应用（对应设置 UI `algorithmPreferences` / 连接 payload `algorithms`）

use serde_json::Value;
use ssh2::{MethodType, Session};

/// 用户选择的 SSH 算法偏好（各类别有序列表，靠前优先）
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct AlgorithmPreferences {
    /// 密钥交换
    pub kex: Vec<String>,
    /// 主机密钥
    pub server_host_key: Vec<String>,
    /// 对称加密（双向使用同一列表）
    pub cipher: Vec<String>,
    /// MAC（双向使用同一列表）
    pub hmac: Vec<String>,
    /// 压缩（双向使用同一列表）
    pub compress: Vec<String>,
}

/// 从连接 JSON 的 `algorithms` 对象解析偏好；缺失或非对象则返回 None。
/// 对象存在时即使各类均为空数组也会返回 Some（表示用户显式清空，不能回退默认）。
/// # 参数
/// - v: 连接 JSON 的 `algorithms` 对象
/// # 返回
/// 一个包含 AlgorithmPreferences 的 Option，如果解析成功则返回 Some(AlgorithmPreferences)，否则返回 None
pub fn parse_algorithms(v: &Value) -> Option<AlgorithmPreferences> {
    let alg = v.get("algorithms")?;
    if !alg.is_object() {
        return None;
    }
    Some(AlgorithmPreferences {
        kex: parse_string_list(alg, "kex"),
        server_host_key: parse_string_list(alg, "serverHostKey"),
        cipher: parse_string_list(alg, "cipher"),
        hmac: parse_string_list(alg, "hmac"),
        compress: parse_string_list(alg, "compress"),
    })
}

/// 解析字符串列表
/// # 参数
/// - v: 连接 JSON 的 `algorithms` 对象
/// - key: 字符串列表的键
/// # 返回
/// 一个包含 Vec<String> 的列表，如果解析成功则返回 Vec<String>，否则返回空列表
fn parse_string_list(v: &Value, key: &str) -> Vec<String> {
    v.get(key)
        .and_then(|x| x.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|x| x.as_str())
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .map(|s| s.to_string())
                .collect()
        })
        .unwrap_or_default()
}

/// 在 handshake 之前应用算法偏好；库不支持的名字会被 libssh2 忽略。
/// kex / hostkey / cipher / hmac 任一为空则拒绝连接（空列表不得回退为库默认集）。
/// # 参数
/// - sess: SSH 会话
/// - prefs: 算法偏好
/// # 返回
/// 一个包含 Result<(), String> 的异程结果，如果应用成功则返回 Ok(())，否则返回 Err(String)
pub fn apply_algorithm_preferences(
    sess: &Session,
    prefs: &AlgorithmPreferences,
) -> Result<(), String> {
    if prefs.kex.is_empty()
        || prefs.server_host_key.is_empty()
        || prefs.cipher.is_empty()
        || prefs.hmac.is_empty()
    {
        return Err("ssh.emptyAlgorithms".into());
    }

    apply_pref(sess, MethodType::Kex, &prefs.kex)?;
    apply_pref(sess, MethodType::HostKey, &prefs.server_host_key)?;
    apply_pref(sess, MethodType::CryptCs, &prefs.cipher)?;
    apply_pref(sess, MethodType::CryptSc, &prefs.cipher)?;
    apply_pref(sess, MethodType::MacCs, &prefs.hmac)?;
    apply_pref(sess, MethodType::MacSc, &prefs.hmac)?;

    let compress = if prefs.compress.is_empty() {
        vec!["none".to_string()]
    } else {
        prefs.compress.clone()
    };
    let wants_compress = compress.iter().any(|c| c.as_str() != "none");
    if wants_compress {
        sess.set_compress(true);
    }
    apply_pref(sess, MethodType::CompCs, &compress)?;
    apply_pref(sess, MethodType::CompSc, &compress)?;
    Ok(())
}

/// 应用算法偏好
/// # 参数
/// - sess: SSH 会话
/// - method_type: 方法类型
/// - list: 算法列表
/// # 返回
/// 一个包含 Result<(), String> 的异程结果，如果应用成功则返回 Ok(())，否则返回 Err(String)
fn apply_pref(sess: &Session, method_type: MethodType, list: &[String]) -> Result<(), String> {
    let joined = list.join(",");
    sess.method_pref(method_type, &joined)
        .map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    /// 测试解析算法偏好
    #[test]
    fn parse_algorithms_reads_frontend_shape() {
        let v = json!({
            "algorithms": {
                "kex": ["curve25519-sha256", ""],
                "serverHostKey": ["ssh-ed25519"],
                "cipher": ["aes128-ctr"],
                "hmac": ["hmac-sha2-256"],
                "compress": ["none"]
            }
        });
        let prefs = parse_algorithms(&v).expect("prefs");
        assert_eq!(prefs.kex, vec!["curve25519-sha256"]);
        assert_eq!(prefs.server_host_key, vec!["ssh-ed25519"]);
        assert_eq!(prefs.cipher, vec!["aes128-ctr"]);
        assert_eq!(prefs.hmac, vec!["hmac-sha2-256"]);
        assert_eq!(prefs.compress, vec!["none"]);
    }

    /// 测试解析算法偏好时返回 None 的情况
    #[test]
    fn parse_algorithms_none_when_missing_or_invalid() {
        assert!(parse_algorithms(&json!({})).is_none());
        assert!(parse_algorithms(&json!({ "algorithms": "nope" })).is_none());
    }

    /// 测试解析算法偏好时返回空对象的情况
    #[test]
    fn parse_algorithms_keeps_explicit_empty_object() {
        let prefs = parse_algorithms(&json!({ "algorithms": {} })).expect("prefs");
        assert_eq!(prefs, AlgorithmPreferences::default());
    }

    /// 测试应用算法偏好时返回空列表的情况
    #[test]
    fn apply_rejects_empty_required_categories() {
        let sess = Session::new().expect("session");
        let err = apply_algorithm_preferences(&sess, &AlgorithmPreferences::default())
            .expect_err("empty should fail");
        assert_eq!(err, "ssh.emptyAlgorithms");
    }

    /// 测试应用算法偏好时返回空列表的情况
    #[test]
    fn apply_algorithm_preferences_accepts_session() {
        let sess = Session::new().expect("session");
        let prefs = AlgorithmPreferences {
            kex: vec!["curve25519-sha256".into()],
            server_host_key: vec!["ssh-ed25519".into()],
            cipher: vec!["aes128-ctr".into()],
            hmac: vec!["hmac-sha2-256".into()],
            compress: vec!["zlib".into(), "none".into()],
        };
        apply_algorithm_preferences(&sess, &prefs).expect("apply");
    }
}
