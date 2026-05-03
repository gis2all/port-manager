use async_trait::async_trait;

#[async_trait]
pub trait ProcessController: Send + Sync {
    async fn kill_pid(&self, pid: u32) -> anyhow::Result<()>;
}
