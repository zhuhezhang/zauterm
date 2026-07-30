use super::SessionCmd;
use tokio::sync::mpsc;

pub struct SshSessionHandle {
    pub cmd_tx: mpsc::UnboundedSender<SessionCmd>,
}
