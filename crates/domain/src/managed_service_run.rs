use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum ServiceRunStatus {
    Running,
    Stopped,
    Starting,
    Failed,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum RunOwnership {
    Managed,
    ExternalDetected,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ManagedServiceRun {
    pub service_id: Uuid,
    pub status: ServiceRunStatus,
    pub root_pid: Option<u32>,
    pub child_pids: Vec<u32>,
    pub started_at: Option<DateTime<Utc>>,
    pub last_exit_code: Option<i32>,
    pub log_path: Option<String>,
    pub ownership: RunOwnership,
}
