//! Local path allowlist (ported from electron/lib/localPathPolicy.ts)

use std::path::{Path, PathBuf};

fn home_dir() -> Option<PathBuf> {
    dirs::home_dir()
}

fn push_if_exists(set: &mut Vec<PathBuf>, p: PathBuf) {
    if let Ok(c) = p.canonicalize() {
        if !set.iter().any(|x| x == &c) {
            set.push(c);
        }
    } else if p.exists() {
        if !set.iter().any(|x| x == &p) {
            set.push(p);
        }
    }
}

pub fn collect_resolved_roots(app_data: &Path) -> Vec<PathBuf> {
    let mut set = Vec::new();
    if let Some(home) = home_dir() {
        push_if_exists(&mut set, home.clone());
        for sub in ["Documents", "Downloads", "Desktop", "Music", "Pictures", "Movies", "Videos"] {
            push_if_exists(&mut set, home.join(sub));
        }
        // Linux XDG
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
    collect_windows_drive_roots(&mut set);
    #[cfg(target_os = "macos")]
    collect_macos_volume_roots(&mut set);
    #[cfg(all(unix, not(target_os = "macos")))]
    collect_linux_mount_roots(&mut set);

    set
}

#[cfg(target_os = "windows")]
fn collect_windows_drive_roots(set: &mut Vec<PathBuf>) {
    for letter in b'A'..=b'Z' {
        let root = PathBuf::from(format!("{}:\\", letter as char));
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
            push_if_exists(set, e.path());
        }
    }
}

#[cfg(all(unix, not(target_os = "macos")))]
fn collect_linux_mount_roots(set: &mut Vec<PathBuf>) {
    let pseudo = [
        "tmpfs", "proc", "sysfs", "devtmpfs", "devpts", "cgroup", "cgroup2", "overlay", "squashfs",
        "ramfs", "aufs", "mqueue", "hugetlbfs", "debugfs", "tracefs", "securityfs", "pstore",
        "bpf", "configfs", "fusectl", "rpc_pipefs", "binfmt_misc", "autofs",
    ];
    let content = std::fs::read_to_string("/proc/mounts")
        .or_else(|_| std::fs::read_to_string("/etc/mtab"))
        .unwrap_or_default();
    for line in content.lines() {
        let parts: Vec<_> = line.split_whitespace().collect();
        if parts.len() < 3 {
            continue;
        }
        let fstype = parts[2];
        if pseudo.iter().any(|p| *p == fstype) {
            continue;
        }
        let mount = parts[1].replace("\\040", " ");
        if mount.starts_with('/') {
            push_if_exists(set, PathBuf::from(mount));
        }
    }
}

pub fn is_path_within_roots(path: &Path, roots: &[PathBuf]) -> bool {
    let resolved = path.canonicalize().unwrap_or_else(|_| path.to_path_buf());
    for root in roots {
        if resolved.starts_with(root) {
            return true;
        }
        // also allow if path string starts with root (not yet existing files)
        if path.starts_with(root) {
            return true;
        }
        if let (Some(rp), Some(pp)) = (root.to_str(), path.to_str()) {
            let r = rp.trim_end_matches(['/', '\\']);
            if pp == r || pp.starts_with(&(r.to_string() + "/")) || pp.starts_with(&(r.to_string() + "\\")) {
                return true;
            }
        }
    }
    false
}

pub fn assert_path_allowed(path: &Path, roots: &[PathBuf], code: &str) -> Result<(), String> {
    if is_path_within_roots(path, roots) {
        Ok(())
    } else {
        Err(code.to_string())
    }
}

pub fn validate_log_directory(dir: &str, roots: &[PathBuf]) -> Result<(), String> {
    let p = PathBuf::from(dir);
    if dir.trim().is_empty() {
        return Err("app.invalidRequest".into());
    }
    assert_path_allowed(&p, roots, "sftp.pathErrors.localDirDenied")
}

pub fn validate_local_file_path(file_path: &str, roots: &[PathBuf]) -> Result<(), String> {
    let p = PathBuf::from(file_path);
    if file_path.trim().is_empty() {
        return Err("app.invalidRequest".into());
    }
    assert_path_allowed(&p, roots, "sftp.pathErrors.localFileDenied")
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
