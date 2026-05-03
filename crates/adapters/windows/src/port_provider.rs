use crate::mapper::map_socket_info;
use anyhow::Result;
use async_trait::async_trait;
use netstat2::{iterate_sockets_info, AddressFamilyFlags, ProtocolFlags};
use pm_domain::PortRecord;
use pm_ports::PortProvider;
use sysinfo::{Pid, System};

pub struct WindowsPortProvider;

#[async_trait]
impl PortProvider for WindowsPortProvider {
    async fn scan_ports(&self) -> Result<Vec<PortRecord>> {
        let system = System::new_all();
        let sockets = iterate_sockets_info(
            AddressFamilyFlags::IPV4 | AddressFamilyFlags::IPV6,
            ProtocolFlags::TCP | ProtocolFlags::UDP,
        )?;

        let mut ports = Vec::new();
        for socket in sockets {
            let socket = socket?;
            let process_name = socket
                .associated_pids
                .first()
                .and_then(|pid| system.process(Pid::from_u32(*pid)))
                .map(|process| process.name().to_string_lossy().into_owned());
            ports.push(map_socket_info(&socket, process_name));
        }

        ports.sort_by(|left, right| {
            left.port
                .cmp(&right.port)
                .then_with(|| left.listen_address.cmp(&right.listen_address))
        });
        ports.dedup();

        Ok(ports)
    }
}
