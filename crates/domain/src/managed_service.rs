use serde::{Deserialize, Serialize};
use uuid::Uuid;

pub type ManagedServiceId = Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum ServiceKind {
    WindowsService,
    Command,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ManagedService {
    pub id: ManagedServiceId,
    pub name: String,
    pub kind: ServiceKind,
    pub service_name: Option<String>,
    pub workdir: Option<String>,
    pub start_command: Option<String>,
    pub stop_command: Option<String>,
    pub expected_ports: Vec<u16>,
    pub tags: Vec<String>,
    pub auto_detected_from: Option<String>,
}

impl ManagedService {
    pub fn command(
        name: impl Into<String>,
        start_command: impl Into<String>,
        workdir: Option<String>,
        expected_ports: Vec<u16>,
    ) -> Self {
        Self {
            id: Uuid::new_v4(),
            name: name.into(),
            kind: ServiceKind::Command,
            service_name: None,
            workdir,
            start_command: Some(start_command.into()),
            stop_command: None,
            expected_ports,
            tags: Vec::new(),
            auto_detected_from: None,
        }
    }

    pub fn expects_port(&self, port: u16) -> bool {
        self.expected_ports.contains(&port)
    }
}
