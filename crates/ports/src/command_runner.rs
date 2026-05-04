use async_trait::async_trait;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StartCommandRequest {
    pub service_id: String,
    pub service_name: String,
    pub command: String,
    pub workdir: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CommandRunHandle {
    pub root_pid: u32,
    pub child_pids: Vec<u32>,
    pub log_path: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StopCommandRequest {
    pub root_pid: u32,
    pub child_pids: Vec<u32>,
    pub stop_command: Option<String>,
    pub workdir: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CommandStopResult {
    pub child_pids: Vec<u32>,
    pub last_exit_code: Option<i32>,
}

#[async_trait]
pub trait CommandRunner: Send + Sync {
    async fn start(&self, request: StartCommandRequest) -> anyhow::Result<CommandRunHandle>;
    async fn stop(&self, request: StopCommandRequest) -> anyhow::Result<CommandStopResult>;
}
