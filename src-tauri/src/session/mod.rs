//! SSH / SFTP / Telnet / Serial 会话管理器

pub mod ssh;
pub mod sftp;
pub mod stream;

use dashmap::DashMap;
use std::sync::Arc;

/// 会话 ID
pub type SessionId = String;

/// 应用程序状态
#[derive(Clone)]
pub struct AppState {
    /// SSH 会话句柄
    pub ssh: Arc<DashMap<SessionId, ssh::SshSessionHandle>>,
    /// SFTP 会话句柄
    pub sftp: Arc<DashMap<SessionId, sftp::SftpSessionHandle>>,
    /// Telnet 会话句柄
    pub telnet: Arc<DashMap<SessionId, stream::StreamSessionHandle>>,
    /// Serial 会话句柄
    pub serial: Arc<DashMap<SessionId, stream::StreamSessionHandle>>,
    /// 已知主机状态
    pub known_hosts: Arc<crate::known_hosts::KnownHostsState>,
    /// 用户界面语言
    pub ui_language: Arc<parking_lot::Mutex<String>>,
}

impl Default for AppState {
    /// 默认实现
    fn default() -> Self {
        Self {
            ssh: Arc::new(DashMap::new()),
            sftp: Arc::new(DashMap::new()),
            telnet: Arc::new(DashMap::new()),
            serial: Arc::new(DashMap::new()),
            known_hosts: Arc::new(crate::known_hosts::KnownHostsState::default()),
            ui_language: Arc::new(parking_lot::Mutex::new("zh".into())),
        }
    }
}

/// 会话命令
pub enum SessionCmd {
    /// 写入数据
    Write(Vec<u8>),
    /// 调整大小
    Resize { cols: u32, rows: u32 },
    /// 断开连接
    Disconnect,
}
