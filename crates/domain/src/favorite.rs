use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use crate::ManagedServiceId;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum FavoriteTarget {
    Port(u16),
    PortRow { key: String, port: u16 },
    Service(ManagedServiceId),
}

impl FavoriteTarget {
    pub fn key(&self) -> String {
        match self {
            Self::Port(port) => format!("port:{port}"),
            Self::PortRow { key, .. } => format!("port-row:{key}"),
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
