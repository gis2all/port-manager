use async_trait::async_trait;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StartCommandRequest {
    pub command: String,
    pub workdir: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CommandRunHandle {
    pub root_pid: u32,
    pub child_pids: Vec<u32>,
    pub log_path: Option<String>,
}

#[async_trait]
pub trait CommandRunner: Send + Sync {
    async fn start(&self, request: StartCommandRequest) -> anyhow::Result<CommandRunHandle>;
    async fn stop(&self, root_pid: u32) -> anyhow::Result<()>;
}
