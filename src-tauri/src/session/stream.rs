use super::SessionCmd;
use tokio::sync::mpsc;

/// 流会话句柄
pub struct StreamSessionHandle {
    /// 命令发送器
    pub cmd_tx: mpsc::UnboundedSender<SessionCmd>,
}
