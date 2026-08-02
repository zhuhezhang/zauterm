use tokio::sync::{mpsc, oneshot};

/// SFTP 命令
pub enum SftpCmd {
    /// 列出目录
    List {
        /// 远程路径
        remote_path: String,
        /// 回复发送器
        reply: oneshot::Sender<Result<serde_json::Value, String>>,
    },
    /// 下载文件
    Download {
        /// 远程路径
        remote_path: String,
        /// 本地路径
        local_path: String,
        /// 回复发送器
        reply: oneshot::Sender<Result<(), String>>,
    },
    /// 下载目录
    DownloadDir {
        /// 远程目录
        remote_dir: String,
        /// 本地目录
        local_dir: String,
        /// 回复发送器
        reply: oneshot::Sender<Result<(), String>>,
    },
    /// 上传文件
    Upload {
        /// 本地路径
        local_path: String,
        /// 远程路径
        remote_path: String,
        /// 回复发送器
        reply: oneshot::Sender<Result<(), String>>,
    },
    /// 上传字节
    UploadBytes {
        /// 远程路径
        remote_path: String,
        /// 数据
        data: Vec<u8>,
        /// 回复发送器
        reply: oneshot::Sender<Result<(), String>>,
    },
    /// 创建目录
    Mkdir {
        /// 远程路径
        remote_path: String,
        /// 回复发送器
        reply: oneshot::Sender<Result<(), String>>,
    },
    /// 删除路径
    Delete {
        /// 远程路径
        remote_path: String,
        /// 回复发送器
        reply: oneshot::Sender<Result<(), String>>,
    },
    /// 重命名路径
    Rename {
        /// 旧路径
        old_path: String,
        /// 新路径
        new_path: String,
        /// 回复发送器
        reply: oneshot::Sender<Result<(), String>>,
    },
    /// 断开连接
    Disconnect,
}

/// SFTP 会话句柄
pub struct SftpSessionHandle {
    /// 命令发送器
    pub cmd_tx: mpsc::UnboundedSender<SftpCmd>,
}
