use super::SessionCmd;
use tokio::sync::mpsc;

/// SSH 会话句柄
pub struct SshSessionHandle {
    /// 命令发送器
    pub cmd_tx: mpsc::UnboundedSender<SessionCmd>,
}
