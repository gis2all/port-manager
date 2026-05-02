use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum FavoriteTarget {
    Port(u16),
    Service(Uuid),
}

impl FavoriteTarget {
    pub fn key(&self) -> String {
        match self {
            Self::Port(port) => format!("port:{port}"),
            Self::Service(id) => format!("service:{id}"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Favorite {
    pub target: FavoriteTarget,
    pub created_at: DateTime<Utc>,
}

impl Favorite {
    pub fn new(target: FavoriteTarget) -> Self {
        Self {
            target,
            created_at: Utc::now(),
        }
    }
}
