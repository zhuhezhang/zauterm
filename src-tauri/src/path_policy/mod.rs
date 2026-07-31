//! Local path allowlist (aligned with electron/lib/localPathPolicy.ts)
//!
//! Allow: user dirs + app data; on Windows whole non-system drives;
//! on Linux/Unix non-root persisted mounts; on macOS /Volumes entries.

use std::path::{Path, PathBuf};

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

/// Strip Windows `\\?\` / `\\?\UNC\` prefixes so dialog paths match canonical roots.
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

/// Comparable path key (Windows: case-insensitive, `/` → `\`).
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

/// Resolve for policy checks. Non-existent save targets resolve via parent dir.
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

/// Windows system drive root (e.g. `C:\`), excluded from whole-drive allow.
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

/// Windows: whole-drive roots except the system drive (aligned with Electron).
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

#[cfg(all(unix, not(target_os = "macos")))]
fn is_network_fstype(fstype: &str) -> bool {
    matches!(fstype, "nfs" | "nfs4" | "cifs" | "smbfs" | "smb3")
}

/// Persisted block/network/fuse mounts (Electron `isPersistedMountDevice`).
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

/// Linux: non-`/` persisted mounts only (aligned with Electron).
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

pub fn assert_path_allowed(path: &Path, roots: &[PathBuf]) -> Result<(), String> {
    if is_path_within_roots(path, roots) {
        Ok(())
    } else {
        Err("sftp.pathErrors.localDirDenied".into())
    }
}

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

pub fn validate_local_file_path(file_path: &str, roots: &[PathBuf]) -> Result<(), String> {
    let p = PathBuf::from(file_path);
    if file_path.trim().is_empty() {
        return Err("app.invalidRequest".into());
    }
    assert_path_allowed(&p, roots)
}

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
