use crate::dto::{DashboardSnapshotDto, ManagedServiceDto, PortDto};
use crate::errors::ApplicationError;
use anyhow::Result;
use pm_domain::{Favorite, FavoriteTarget, ManagedService, PortProtocol, PortRecord, PortStatus, ServiceKind};

pub struct PortManagerService {
    ports: Vec<PortRecord>,
    services: Vec<ManagedService>,
    favorites: Vec<Favorite>,
}

impl PortManagerService {
    pub fn new_for_tests(
        ports: Vec<PortRecord>,
        services: Vec<ManagedService>,
        favorites: Vec<Favorite>,
    ) -> Self {
        Self {
            ports,
            services,
            favorites,
        }
    }

    pub fn dashboard_snapshot(&self) -> Result<DashboardSnapshotDto> {
        let ports = self
            .ports
            .iter()
            .map(|port| {
                let matched = self.services.iter().find(|service| service.expects_port(port.port));
                PortDto {
                    port: port.port,
                    protocol: match port.protocol {
                        PortProtocol::Tcp => "tcp".into(),
                        PortProtocol::Udp => "udp".into(),
                    },
                    listen_address: port.listen_address.clone(),
                    pid: port.pid,
                    process_name: port.process_name.clone(),
                    status: match port.status {
                        PortStatus::Listening => "listening".into(),
                        PortStatus::Active => "active".into(),
                        PortStatus::Closed => "closed".into(),
                        PortStatus::Unknown => "unknown".into(),
                    },
                    is_favorite: self
                        .favorites
                        .iter()
                        .any(|favorite| favorite.target == FavoriteTarget::Port(port.port)),
                    matched_service_id: matched.map(|service| service.id),
                    matched_service_name: matched.map(|service| service.name.clone()),
                }
            })
            .collect();

        let services = self
            .services
            .iter()
            .map(|service| ManagedServiceDto {
                id: service.id,
                name: service.name.clone(),
                kind: match service.kind {
                    ServiceKind::WindowsService => "windows_service".into(),
                    ServiceKind::Command => "command".into(),
                },
                expected_ports: service.expected_ports.clone(),
            })
            .collect();

        Ok(DashboardSnapshotDto { ports, services })
    }

    pub fn kill_process_by_port(&self, port: u16) -> std::result::Result<u32, ApplicationError> {
        self.ports
            .iter()
            .find(|record| record.port == port)
            .and_then(|record| record.pid)
            .ok_or(ApplicationError::PortOwnerMissing(port))
    }
}
