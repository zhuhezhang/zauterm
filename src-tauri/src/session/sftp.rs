use tokio::sync::{mpsc, oneshot};

pub enum SftpCmd {
    List {
        remote_path: String,
        reply: oneshot::Sender<Result<serde_json::Value, String>>,
    },
    Download {
        remote_path: String,
        local_path: String,
        reply: oneshot::Sender<Result<(), String>>,
    },
    DownloadDir {
        remote_dir: String,
        local_dir: String,
        reply: oneshot::Sender<Result<(), String>>,
    },
    Upload {
        local_path: String,
        remote_path: String,
        reply: oneshot::Sender<Result<(), String>>,
    },
    UploadBytes {
        remote_path: String,
        data: Vec<u8>,
        reply: oneshot::Sender<Result<(), String>>,
    },
    Mkdir {
        remote_path: String,
        reply: oneshot::Sender<Result<(), String>>,
    },
    Delete {
        remote_path: String,
        reply: oneshot::Sender<Result<(), String>>,
    },
    Rename {
        old_path: String,
        new_path: String,
        reply: oneshot::Sender<Result<(), String>>,
    },
    Disconnect,
}

pub struct SftpSessionHandle {
    pub cmd_tx: mpsc::UnboundedSender<SftpCmd>,
}
