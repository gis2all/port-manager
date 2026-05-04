use chrono::{DateTime, Utc};
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
    pub service_name: Option<String>,
    pub workdir: Option<String>,
    pub start_command: Option<String>,
    pub stop_command: Option<String>,
    pub auto_detected_from: Option<String>,
    pub expected_ports: Vec<u16>,
    pub observed_ports: Vec<u16>,
    pub status: String,
    pub is_favorite: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ManagedServiceDraftDto {
    pub name: String,
    pub kind: String,
    pub service_name: Option<String>,
    pub workdir: Option<String>,
    pub start_command: Option<String>,
    pub stop_command: Option<String>,
    pub auto_detected_from: Option<String>,
    pub expected_ports: Vec<u16>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct DashboardSnapshotDto {
    pub ports: Vec<PortDto>,
    pub services: Vec<ManagedServiceDto>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ProcessDetailDto {
    pub pid: u32,
    pub process_name: Option<String>,
    pub executable_path: Option<String>,
    pub started_at: Option<DateTime<Utc>>,
    pub working_set_bytes: Option<u64>,
    pub private_bytes: Option<u64>,
    pub vendor: Option<String>,
    pub file_version: Option<String>,
    pub digital_signature: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct DetectedServiceCandidateDto {
    pub name: String,
    pub start_command: String,
    pub workdir: String,
    pub expected_ports: Vec<u16>,
    pub detected_from: String,
}
