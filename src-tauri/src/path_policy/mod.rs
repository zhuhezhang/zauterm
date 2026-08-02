//! 本读允许读写的路径 (和 Electron 的 localPathPolicy.ts 一致)
//! 允许: 用户目录 + 应用数据; 在 Windows 上整个非系统盘;
//! 在 Linux/Unix 上非根持久挂载; 在 macOS /Volumes 条目.

use std::path::{Path, PathBuf};

/// 如果路径存在则添加到集合中
/// # 参数
/// - set: 集合
/// - p: 路径
fn push_if_exists(set: &mut Vec<PathBuf>, p: PathBuf) {
    if let Ok(c) = p.canonicalize() {
        let n = strip_verbatim_prefix(c);
        if !set.iter().any(|x| path_key(x) == path_key(&n)) {
            set.push(n);
        }
    } else if p.exists() {
        let n = strip_verbatim_prefix(p);
        if !set.iter().any(|x| path_key(x) == path_key(&n)) {
            set.push(n);
        }
    }
}

/// 删除 Windows `\\?\` / `\\?\UNC\` 前缀, 使对话路径与规范根匹配
/// # 参数
/// - p: 路径
/// # 返回
/// 一个包含 PathBuf 的规范路径
fn strip_verbatim_prefix(p: PathBuf) -> PathBuf {
    #[cfg(windows)]
    {
        let s = p.to_string_lossy();
        if let Some(rest) = s.strip_prefix(r"\\?\UNC\") {
            return PathBuf::from(format!(r"\\{rest}"));
        }
        if let Some(rest) = s.strip_prefix(r"\\?\") {
            return PathBuf::from(rest);
        }
        p
    }
    #[cfg(not(windows))]
    {
        p
    }
}

/// 可比较路径键 (Windows: 大小写不敏感, `/` → `\`)
/// # 参数
/// - p: 路径
/// # 返回
/// 一个包含 String 的可比较路径键
fn path_key(p: &Path) -> String {
    let s = p.to_string_lossy();
    #[cfg(windows)]
    {
        s.replace('/', "\\").trim_end_matches('\\').to_lowercase()
    }
    #[cfg(not(windows))]
    {
        s.trim_end_matches('/').to_string()
    }
}

/// 解析策略检查，非存在的保存目标通过父目录解析
/// # 参数
/// - path: 路径
/// # 返回
/// 一个包含 PathBuf 的规范路径
fn resolve_for_policy(path: &Path) -> PathBuf {
    if let Ok(c) = path.canonicalize() {
        return strip_verbatim_prefix(c);
    }
    if let Some(parent) = path.parent() {
        if !parent.as_os_str().is_empty() {
            if let Ok(cp) = parent.canonicalize() {
                let joined = strip_verbatim_prefix(cp).join(path.file_name().unwrap_or_default());
                return strip_verbatim_prefix(joined);
            }
        }
    }
    strip_verbatim_prefix(path.to_path_buf())
}

/// 收集解析后的根
/// # 参数
/// - app_data: 应用数据
/// # 返回
/// 一个包含 PathBuf 的集合
pub fn collect_resolved_roots(app_data: &Path) -> Vec<PathBuf> {
    let mut set = Vec::new();
    if let Some(home) = dirs::home_dir() {
        push_if_exists(&mut set, home.clone());
        // Localized folder names (e.g. Chinese Linux) not always covered by dirs::*
        for sub in ["文档", "下载", "桌面"] {
            push_if_exists(&mut set, home.join(sub));
        }
    }
    if let Some(d) = dirs::document_dir() {
        push_if_exists(&mut set, d);
    }
    if let Some(d) = dirs::download_dir() {
        push_if_exists(&mut set, d);
    }
    if let Some(d) = dirs::desktop_dir() {
        push_if_exists(&mut set, d);
    }
    if let Some(d) = dirs::audio_dir() {
        push_if_exists(&mut set, d);
    }
    if let Some(d) = dirs::picture_dir() {
        push_if_exists(&mut set, d);
    }
    if let Some(d) = dirs::video_dir() {
        push_if_exists(&mut set, d);
    }
    push_if_exists(&mut set, app_data.to_path_buf());

    #[cfg(target_os = "windows")]
    collect_windows_non_system_drive_roots(&mut set);
    #[cfg(target_os = "macos")]
    collect_macos_volume_roots(&mut set);
    #[cfg(all(unix, not(target_os = "macos")))]
    collect_linux_non_system_mount_roots(&mut set);

    set
}

/// Windows 系统驱动器根 (例如 `C:\`), 排除在整个驱动器允许之外
/// # 返回
/// 一个包含 PathBuf 的系统驱动器根
#[cfg(target_os = "windows")]
fn windows_system_drive_root() -> PathBuf {
    if let Ok(sd) = std::env::var("SystemDrive").or_else(|_| std::env::var("systemdrive")) {
        let letter = sd.trim().trim_end_matches(':');
        if !letter.is_empty() {
            return PathBuf::from(format!("{}:\\", letter));
        }
    }
    if let Ok(windir) = std::env::var("windir").or_else(|_| std::env::var("WINDIR")) {
        let p = PathBuf::from(windir);
        let mut comps = p.components();
        if let (Some(std::path::Component::Prefix(prefix)), Some(std::path::Component::RootDir)) =
            (comps.next(), comps.next())
        {
            let mut root = PathBuf::new();
            root.push(prefix.as_os_str());
            root.push(std::path::Component::RootDir);
            return root;
        }
    }
    PathBuf::from("C:\\")
}

/// Windows: 整个驱动器根除了系统驱动器 (和 Electron 一致)
/// # 参数
/// - set: 集合
/// # 返回
/// 一个包含 PathBuf 的集合
#[cfg(target_os = "windows")]
fn collect_windows_non_system_drive_roots(set: &mut Vec<PathBuf>) {
    let system_key = path_key(&windows_system_drive_root());
    for letter in b'A'..=b'Z' {
        let root = PathBuf::from(format!("{}:\\", letter as char));
        if path_key(&root) == system_key {
            continue;
        }
        if root.exists() {
            push_if_exists(set, root);
        }
    }
}

/// macOS: 卷根 (例如 `/Volumes`)
/// # 参数
/// - set: 集合
/// # 返回
/// 一个包含 PathBuf 的集合
#[cfg(target_os = "macos")]
fn collect_macos_volume_roots(set: &mut Vec<PathBuf>) {
    let volumes = PathBuf::from("/Volumes");
    if let Ok(rd) = std::fs::read_dir(&volumes) {
        for e in rd.flatten() {
            let name = e.file_name();
            let name = name.to_string_lossy();
            if name.starts_with('.') {
                continue;
            }
            push_if_exists(set, e.path());
        }
    }
}

/// Linux: 伪文件系统类型
/// # 参数
/// - fstype: 文件系统类型
/// # 返回
/// 一个包含 bool 的伪文件系统类型
#[cfg(all(unix, not(target_os = "macos")))]
fn is_pseudo_fstype(fstype: &str) -> bool {
    matches!(
        fstype,
        "tmpfs"
            | "devtmpfs"
            | "proc"
            | "sysfs"
            | "devpts"
            | "cgroup"
            | "cgroup2"
            | "pstore"
            | "bpf"
            | "tracefs"
            | "debugfs"
            | "securityfs"
            | "hugetlbfs"
            | "mqueue"
            | "configfs"
            | "fusectl"
            | "autofs"
            | "binfmt_misc"
            | "ramfs"
            | "overlay"
            | "squashfs"
            | "nsfs"
            | "efivarfs"
            | "rpc_pipefs"
            | "aufs"
    )
}

/// 网络文件系统类型
/// # 参数
/// - fstype: 文件系统类型
/// # 返回
/// 一个包含 bool 的网络文件系统类型
#[cfg(all(unix, not(target_os = "macos")))]
fn is_network_fstype(fstype: &str) -> bool {
    matches!(fstype, "nfs" | "nfs4" | "cifs" | "smbfs" | "smb3")
}

/// 持久化块/网络/fuse 挂载 (Electron `isPersistedMountDevice`)
/// # 参数
/// - device: 设备
/// - fstype: 文件系统类型
/// # 返回
/// 一个包含 bool 的持久化块/网络/fuse 挂载
#[cfg(all(unix, not(target_os = "macos")))]
fn is_persisted_mount_device(device: &str, fstype: &str) -> bool {
    if is_pseudo_fstype(fstype) {
        return false;
    }
    if device.starts_with("/dev/") {
        return true;
    }
    if is_network_fstype(fstype) {
        return true;
    }
    if fstype.starts_with("fuse.") && fstype != "fuse.portal" {
        return true;
    }
    false
}

/// Linux: 非 `/` 持久挂载只 (和 Electron 一致)
/// # 参数
/// - set: 集合
/// # 返回
/// 一个包含 PathBuf 的集合
#[cfg(all(unix, not(target_os = "macos")))]
fn collect_linux_non_system_mount_roots(set: &mut Vec<PathBuf>) {
    let content = std::fs::read_to_string("/proc/mounts")
        .or_else(|_| std::fs::read_to_string("/etc/mtab"))
        .unwrap_or_default();
    let system_root_key = path_key(Path::new("/"));
    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }
        let parts: Vec<_> = trimmed.split_whitespace().collect();
        if parts.len() < 3 {
            continue;
        }
        let device = parts[0];
        let mount = parts[1].replace("\\040", " ");
        let fstype = parts[2];
        if !is_persisted_mount_device(device, fstype) {
            continue;
        }
        if !mount.starts_with('/') {
            continue;
        }
        let mount_path = PathBuf::from(&mount);
        if path_key(&mount_path) == system_root_key {
            continue;
        }
        push_if_exists(set, mount_path);
    }
}

/// 路径是否在根内
/// # 参数
/// - path: 路径
/// - roots: 根
/// # 返回
/// 一个包含 bool 的根内
fn is_path_within_roots(path: &Path, roots: &[PathBuf]) -> bool {
    let normalized = resolve_for_policy(path);
    let nk = path_key(&normalized);
    for root in roots {
        let base = resolve_for_policy(root);
        let bk = path_key(&base);
        if nk == bk {
            return true;
        }
        if nk.starts_with(&(bk.clone() + std::path::MAIN_SEPARATOR_STR)) {
            return true;
        }
    }
    false
}

/// 断言路径允许
/// # 参数
/// - path: 路径
/// - roots: 根
/// # 返回
/// 一个包含 Result 的断言路径允许
pub fn assert_path_allowed(path: &Path, roots: &[PathBuf]) -> Result<(), String> {
    if is_path_within_roots(path, roots) {
        Ok(())
    } else {
        Err("sftp.pathErrors.localDirDenied".into())
    }
}

/// 验证日志目录
/// # 参数
/// - dir: 目录
/// - roots: 根
/// # 返回
/// 一个包含 Result 的验证日志目录
pub fn validate_log_directory(dir: &str, roots: &[PathBuf]) -> Result<(), String> {
    let p = PathBuf::from(dir);
    if dir.trim().is_empty() {
        return Err("app.invalidRequest".into());
    }
    if is_path_within_roots(&p, roots) {
        Ok(())
    } else {
        Err("sftp.pathErrors.logDirDenied".into())
    }
}

/// 验证本地文件路径
/// # 参数
/// - file_path: 文件路径
/// - roots: 根
/// # 返回
/// 一个包含 Result 的验证本地文件路径
pub fn validate_local_file_path(file_path: &str, roots: &[PathBuf]) -> Result<(), String> {
    let p = PathBuf::from(file_path);
    if file_path.trim().is_empty() {
        return Err("app.invalidRequest".into());
    }
    assert_path_allowed(&p, roots)
}

/// 安全文件茎
/// # 参数
/// - name: 名称
/// # 返回
/// 一个包含 String 的安全文件茎
pub fn safe_file_stem(name: &str) -> String {
    let s: String = name
        .chars()
        .map(|c| match c {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '_',
            c if c.is_control() => '_',
            c => c,
        })
        .collect();
    let t = s.trim().trim_matches('.');
    if t.is_empty() {
        "session".into()
    } else {
        t.chars().take(120).collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    /// 唯一临时目录
    /// # 参数
    /// - label: 标签
    /// # 返回
    /// 一个包含 PathBuf 的唯一临时目录
    fn unique_temp_dir(label: &str) -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0);
        let dir = std::env::temp_dir().join(format!(
            "zauterm-path-policy-{}-{}-{}",
            label,
            std::process::id(),
            nanos
        ));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    /// 测试安全文件茎
    #[test]
    fn safe_file_stem_sanitizes_and_truncates() {
        assert_eq!(safe_file_stem("ok"), "ok");
        assert_eq!(safe_file_stem("a/b\\c:d"), "a_b_c_d");
        assert_eq!(safe_file_stem("   "), "session");
        assert_eq!(safe_file_stem("..."), "session");
        let long = "x".repeat(200);
        assert_eq!(safe_file_stem(&long).chars().count(), 120);
    }

    /// 测试断言路径允许在根内
    #[test]
    fn assert_path_allowed_within_root() {
        let root = unique_temp_dir("root");
        let child = root.join("logs").join("a.txt");
        fs::create_dir_all(child.parent().unwrap()).unwrap();
        fs::write(&child, b"x").unwrap();
        let roots = vec![root.clone()];
        assert!(assert_path_allowed(&child, &roots).is_ok());
        assert!(assert_path_allowed(&root, &roots).is_ok());
        let _ = fs::remove_dir_all(&root);
    }

    /// 测试断言路径允许在根外
    #[test]
    fn assert_path_allowed_rejects_outside() {
        let root = unique_temp_dir("allow");
        let outside = unique_temp_dir("deny");
        let roots = vec![root.clone()];
        let err = assert_path_allowed(&outside, &roots).unwrap_err();
        assert_eq!(err, "sftp.pathErrors.localDirDenied");
        let _ = fs::remove_dir_all(&root);
        let _ = fs::remove_dir_all(&outside);
    }

    /// 测试验证日志目录为空
    #[test]
    fn validate_rejects_empty() {
        let roots: Vec<PathBuf> = vec![];
        assert_eq!(
            validate_log_directory("  ", &roots).unwrap_err(),
            "app.invalidRequest"
        );
        assert_eq!(
            validate_local_file_path("", &roots).unwrap_err(),
            "app.invalidRequest"
        );
    }

    /// 测试验证日志目录错误代码
    #[test]
    fn validate_log_directory_error_code() {
        let root = unique_temp_dir("log-root");
        let outside = unique_temp_dir("log-out");
        let err = validate_log_directory(outside.to_str().unwrap(), &[root.clone()]).unwrap_err();
        assert_eq!(err, "sftp.pathErrors.logDirDenied");
        let _ = fs::remove_dir_all(&root);
        let _ = fs::remove_dir_all(&outside);
    }

    /// 测试非存在的子目录在允许的父目录下是 OK
    #[test]
    fn non_existent_child_under_allowed_parent_is_ok() {
        let root = unique_temp_dir("save-parent");
        let target = root.join("new-file.txt");
        assert!(validate_local_file_path(target.to_str().unwrap(), &[root.clone()]).is_ok());
        let _ = fs::remove_dir_all(&root);
    }
}
