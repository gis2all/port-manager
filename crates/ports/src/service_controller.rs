use async_trait::async_trait;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ServiceStatus {
    Running,
    Stopped,
    Starting,
    Unknown,
}

#[async_trait]
pub trait ServiceController: Send + Sync {
    async fn start(&self, service_name: &str) -> anyhow::Result<()>;
    async fn stop(&self, service_name: &str) -> anyhow::Result<()>;
    async fn status(&self, service_name: &str) -> anyhow::Result<ServiceStatus>;
}
