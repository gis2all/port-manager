use async_trait::async_trait;
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProcessDetails {
    pub pid: u32,
    pub executable_path: Option<String>,
    pub started_at: Option<DateTime<Utc>>,
    pub working_set_bytes: Option<u64>,
    pub private_bytes: Option<u64>,
    pub vendor: Option<String>,
    pub file_version: Option<String>,
    pub digital_signature: Option<String>,
}

#[async_trait]
pub trait ProcessController: Send + Sync {
    async fn kill_pid(&self, pid: u32) -> anyhow::Result<()>;
    async fn is_pid_running(&self, pid: u32) -> anyhow::Result<bool>;
    async fn get_process_details(&self, pid: u32) -> anyhow::Result<Option<ProcessDetails>>;
}
