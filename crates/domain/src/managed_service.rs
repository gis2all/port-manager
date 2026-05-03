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
    id: ManagedServiceId,
    name: String,
    kind: ServiceKind,
    service_name: Option<String>,
    workdir: Option<String>,
    start_command: Option<String>,
    stop_command: Option<String>,
    expected_ports: Vec<u16>,
    tags: Vec<String>,
    auto_detected_from: Option<String>,
}

impl ManagedService {
    fn new(
        name: impl Into<String>,
        kind: ServiceKind,
        service_name: Option<String>,
        workdir: Option<String>,
        start_command: Option<String>,
        stop_command: Option<String>,
        expected_ports: Vec<u16>,
    ) -> Self {
        Self {
            id: Uuid::new_v4(),
            name: name.into(),
            kind,
            service_name,
            workdir,
            start_command,
            stop_command,
            expected_ports,
            tags: Vec::new(),
            auto_detected_from: None,
        }
    }

    pub fn command(
        name: impl Into<String>,
        start_command: impl Into<String>,
        workdir: Option<String>,
        expected_ports: Vec<u16>,
    ) -> Self {
        Self::new(
            name,
            ServiceKind::Command,
            None,
            workdir,
            Some(start_command.into()),
            None,
            expected_ports,
        )
    }

    pub fn windows_service(
        name: impl Into<String>,
        service_name: impl Into<String>,
        expected_ports: Vec<u16>,
    ) -> Self {
        Self::new(
            name,
            ServiceKind::WindowsService,
            Some(service_name.into()),
            None,
            None,
            None,
            expected_ports,
        )
    }

    pub fn expects_port(&self, port: u16) -> bool {
        self.expected_ports.contains(&port)
    }

    pub fn id(&self) -> ManagedServiceId {
        self.id
    }

    pub fn name(&self) -> &str {
        &self.name
    }

    pub fn kind(&self) -> &ServiceKind {
        &self.kind
    }

    pub fn service_name(&self) -> Option<&str> {
        self.service_name.as_deref()
    }

    pub fn workdir(&self) -> Option<&str> {
        self.workdir.as_deref()
    }

    pub fn start_command(&self) -> Option<&str> {
        self.start_command.as_deref()
    }

    pub fn stop_command(&self) -> Option<&str> {
        self.stop_command.as_deref()
    }

    pub fn expected_ports(&self) -> &[u16] {
        &self.expected_ports
    }

    pub fn tags(&self) -> &[String] {
        &self.tags
    }

    pub fn auto_detected_from(&self) -> Option<&str> {
        self.auto_detected_from.as_deref()
    }
}
