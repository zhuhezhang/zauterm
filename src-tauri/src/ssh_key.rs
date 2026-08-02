//! SSH 私钥解析（认证时直接调用 `Session::userauth_pubkey_memory`，不使用临时 PEM 文件）

/// 从内联材料或文件系统路径解析 PEM 内容
/// # 参数
/// key_or_path - 私钥或路径字符串
/// # 返回
/// 一个包含 PEM 内容的字符串，如果解析失败则返回错误信息
pub fn resolve_private_key_material(key_or_path: &str) -> Result<String, String> {
    let t = key_or_path.trim();
    if t.contains("BEGIN") && t.contains("KEY") {
        return Ok(t.to_string());
    }
    std::fs::read_to_string(t).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 测试从内联材料解析 PEM 内容
    #[test]
    fn resolve_inline_pem() {
        let pem = "-----BEGIN OPENSSH PRIVATE KEY-----\nabc\n-----END OPENSSH PRIVATE KEY-----";
        let out = resolve_private_key_material(pem).unwrap();
        assert!(out.contains("BEGIN"));
    }

    /// 测试从文件系统路径解析 PEM 内容
    #[test]
    fn resolve_from_file() {
        let path = std::env::temp_dir().join(format!(  // 创建一个测试 PEM 文件
            "zauterm-test-key-{}-{}.pem",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_nanos())
                .unwrap_or(0)
        ));
        std::fs::write(  // 写入一个测试 PEM 文件
            &path,
            "-----BEGIN RSA PRIVATE KEY-----\nxyz\n-----END RSA PRIVATE KEY-----",
        )
        .unwrap();
        let out = resolve_private_key_material(path.to_str().unwrap()).unwrap();  // 解析 PEM 文件
        assert!(out.contains("RSA PRIVATE KEY"));
        let _ = std::fs::remove_file(&path);  // 删除测试 PEM 文件
    }

    /// 测试解析不存在的文件
    #[test]
    fn resolve_missing_file_errors() {
        let err = resolve_private_key_material("/no/such/zauterm-key-file-xyz").unwrap_err();
        assert!(!err.is_empty());
    }
}
