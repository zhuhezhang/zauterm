//! Session managers for SSH / SFTP / Telnet / Serial

pub mod ssh;
pub mod sftp;
pub mod stream;

use dashmap::DashMap;
use std::sync::Arc;

pub type SessionId = String;

#[derive(Clone)]
pub struct AppState {
    pub ssh: Arc<DashMap<SessionId, ssh::SshSessionHandle>>,
    pub sftp: Arc<DashMap<SessionId, sftp::SftpSessionHandle>>,
    pub telnet: Arc<DashMap<SessionId, stream::StreamSessionHandle>>,
    pub serial: Arc<DashMap<SessionId, stream::StreamSessionHandle>>,
    pub known_hosts: Arc<crate::known_hosts::KnownHostsState>,
    pub ui_language: Arc<parking_lot::Mutex<String>>,
}

impl Default for AppState {
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

pub enum SessionCmd {
    Write(Vec<u8>),
    Resize { cols: u32, rows: u32 },
    Disconnect,
}
