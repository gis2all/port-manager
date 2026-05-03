use async_trait::async_trait;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DetectedServiceCandidate {
    pub name: String,
    pub start_command: String,
    pub workdir: String,
    pub expected_ports: Vec<u16>,
    pub detected_from: String,
}

#[async_trait]
pub trait ProjectDetector: Send + Sync {
    async fn detect(&self, root: &str) -> anyhow::Result<Vec<DetectedServiceCandidate>>;
}
