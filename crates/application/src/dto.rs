use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct PortDto {
    pub port: u16,
    pub protocol: String,
    pub listen_address: String,
    pub pid: Option<u32>,
    pub process_name: Option<String>,
    pub status: String,
    pub is_favorite: bool,
    pub matched_service_id: Option<Uuid>,
    pub matched_service_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ManagedServiceDto {
    pub id: Uuid,
    pub name: String,
    pub kind: String,
    pub expected_ports: Vec<u16>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct DashboardSnapshotDto {
    pub ports: Vec<PortDto>,
    pub services: Vec<ManagedServiceDto>,
}
