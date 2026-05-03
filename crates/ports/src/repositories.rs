use async_trait::async_trait;
use pm_domain::{Favorite, FavoriteTarget, ManagedService, ManagedServiceId, ManagedServiceRun};

#[async_trait]
pub trait FavoriteRepository: Send + Sync {
    async fn list(&self) -> anyhow::Result<Vec<Favorite>>;
    async fn upsert(&self, favorite: Favorite) -> anyhow::Result<()>;
    async fn delete(&self, target: &FavoriteTarget) -> anyhow::Result<()>;
}

#[async_trait]
pub trait ManagedServiceRepository: Send + Sync {
    async fn list(&self) -> anyhow::Result<Vec<ManagedService>>;
    async fn get(&self, id: ManagedServiceId) -> anyhow::Result<Option<ManagedService>>;
    async fn save(&self, service: ManagedService) -> anyhow::Result<()>;
    async fn delete(&self, id: ManagedServiceId) -> anyhow::Result<()>;
}

#[async_trait]
pub trait RunStateRepository: Send + Sync {
    async fn get(&self, service_id: ManagedServiceId) -> anyhow::Result<Option<ManagedServiceRun>>;
    async fn save(&self, run: ManagedServiceRun) -> anyhow::Result<()>;
}
