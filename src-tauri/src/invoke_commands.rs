//! 用于单元测试
//! 规范的调用命令列表，用于与 `lib.rs` 中的注册命令保持同步、
//! 与 `src-isolation/index.js` 中的 ALLOWED_CMDS 保持同步（由单元测试强制执行）

#![allow(dead_code)] // 不跑测试编译库时，编译器会认为这两个 pub const「没人用」→ 警告 dead_code。#![allow(dead_code)] 就是关掉这类警告

/// 应用拥有的调用命令（不是 `plugin:*` 插件独有的命令）
pub const REGISTERED_INVOKE_COMMANDS: &[&str] = &[
    "window_minimize",
    "window_maximize",
    "window_close",
    "window_set_background_color",
    "window_is_maximized",
    "window_zoom_wheel_step",
    "app_set_ui_language",
    "app_get_downloads_path",
    "app_get_version",
    "app_open_external",
    "app_choose_open",
    "app_save_file",
    "app_validate_log_directory",
    "app_validate_local_file_path",
    "app_clear_known_hosts",
    "app_clear_session_host_key_cache",
    "log_write",
    "log_append",
    "credentials_is_available",
    "credentials_get",
    "credentials_sync",
    "credentials_remove",
    "credentials_duplicate",
    "credentials_clear_all",
    "ssh_connect",
    "ssh_disconnect",
    "ssh_send_data",
    "ssh_resize",
    "sftp_connect",
    "sftp_disconnect",
    "sftp_list",
    "sftp_download",
    "sftp_download_dir",
    "sftp_upload",
    "sftp_upload_bytes",
    "sftp_mkdir",
    "sftp_delete",
    "sftp_rename",
    "telnet_connect",
    "telnet_disconnect",
    "telnet_send_data",
    "serial_list_ports",
    "serial_connect",
    "serial_disconnect",
    "serial_send_data",
    "local_connect",
    "local_disconnect",
    "local_send_data",
    "local_resize",
];

/// 插件 IPC 命令，前端被允许通过隔离钩子调用
pub const ALLOWED_PLUGIN_COMMANDS: &[&str] = &[
    "plugin:dialog|message",
    "plugin:event|listen",
    "plugin:event|unlisten",
    "plugin:window|start_dragging",
    "plugin:webview|set_webview_zoom",
    "plugin:clipboard-manager|read_text",
    "plugin:clipboard-manager|write_text",
];

#[cfg(test)]  // 通过cargo test 调用，只在单元测试时编译，生产环境不编译
mod tests {
    use super::*;
    use std::collections::HashSet;

    /// 获取 `src-isolation/index.js` 文件内容
    fn isolation_js() -> &'static str {
        include_str!("../../src-isolation/index.js")  // 编译期把 src-isolation/index.js 整文件嵌进二进制，得到一个指向该字符串的引用，生命周期是 'static（和程序一样长，存在于只读数据段）
    }

    /// 测试 `src-isolation/index.js` 中的 ALLOWED_CMDS 是否包含所有注册的命令
    #[test]
    fn isolation_allowlist_contains_every_registered_command() {
        let js = isolation_js();
        for cmd in REGISTERED_INVOKE_COMMANDS {
            let needle = format!("{cmd}: 1");
            assert!(
                js.contains(&needle),  // 若这个条件不符合则报错并打印下面的错误信息
                "src-isolation/index.js missing ALLOWED_CMDS entry for `{cmd}`"
            );
        }
    }

    /// 测试 `src-isolation/index.js` 中的 ALLOWED_CMDS 是否没有多余的命令
    #[test]
    fn isolation_allowlist_has_no_extra_app_commands() {
        let js = isolation_js();
        // 解析 `var ALLOWED_CMDS = { ... }` 中的键
        let start = js
            .find("var ALLOWED_CMDS = {")
            .expect("ALLOWED_CMDS object");
        let rest = &js[start..];
        let end = rest.find("\n}").expect("end of ALLOWED_CMDS");
        let block = &rest[..end];
        let mut listed = HashSet::new();
        for line in block.lines() {
            let t = line.trim();
            if t.is_empty() || t.starts_with("var ") || t.starts_with('/') || t.starts_with('*') {
                continue;
            }
            if let Some(name) = t.split(':').next() {
                let name = name.trim();
                if !name.is_empty() && name.chars().all(|c| c.is_ascii_alphanumeric() || c == '_') {
                    listed.insert(name.to_string());
                }
            }
        }
        let expected: HashSet<_> = REGISTERED_INVOKE_COMMANDS
            .iter()
            .map(|s| (*s).to_string())
            .collect();
        let extra: Vec<_> = listed.difference(&expected).collect();
        let missing: Vec<_> = expected.difference(&listed).collect();
        assert!(
            extra.is_empty(),
            "isolation ALLOWED_CMDS has commands not in REGISTERED_INVOKE_COMMANDS: {extra:?}"
        );
        assert!(
            missing.is_empty(),
            "REGISTERED_INVOKE_COMMANDS missing from isolation: {missing:?}"
        );
    }

    /// 测试 `src-isolation/index.js` 中的 ALLOWED_PLUGIN_CMDS 是否包含所有注册的命令
    #[test]
    fn isolation_plugin_allowlist_matches() {
        let js = isolation_js();
        for cmd in ALLOWED_PLUGIN_COMMANDS {
            let needle = format!("'{cmd}': 1");
            assert!(
                js.contains(&needle),
                "src-isolation/index.js missing ALLOWED_PLUGIN_CMDS entry for `{cmd}`"
            );
        }
        assert!(
            !js.contains("cmd.indexOf('plugin:') === 0"),
            "isolation must not allow all plugin:* commands"
        );
    }
}
