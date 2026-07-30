use super::SessionCmd;
use tokio::sync::mpsc;

pub struct StreamSessionHandle {
    pub cmd_tx: mpsc::UnboundedSender<SessionCmd>,
}
