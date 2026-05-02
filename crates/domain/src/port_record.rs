use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum PortProtocol {
    Tcp,
    Udp,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum PortStatus {
    Listening,
    Active,
    Closed,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct PortRecord {
    pub port: u16,
    pub protocol: PortProtocol,
    pub listen_address: String,
    pub pid: Option<u32>,
    pub process_name: Option<String>,
    pub status: PortStatus,
    pub matched_service_id: Option<Uuid>,
}
