use async_trait::async_trait;
use pm_domain::PortRecord;

#[async_trait]
pub trait PortProvider: Send + Sync {
    async fn scan_ports(&self) -> anyhow::Result<Vec<PortRecord>>;
}
