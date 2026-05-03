use netstat2::{ProtocolSocketInfo, SocketInfo, TcpState};
use pm_domain::{PortProtocol, PortRecord, PortStatus};

pub fn map_socket_info(socket: &SocketInfo, process_name: Option<String>) -> PortRecord {
    let (protocol, status) = match &socket.protocol_socket_info {
        ProtocolSocketInfo::Tcp(tcp) => (PortProtocol::Tcp, map_tcp_state(tcp.state)),
        ProtocolSocketInfo::Udp(_) => (PortProtocol::Udp, PortStatus::Listening),
    };

    PortRecord {
        port: socket.local_port(),
        protocol,
        listen_address: socket.local_addr().to_string(),
        pid: socket.associated_pids.first().copied(),
        process_name,
        status,
        matched_service_id: None,
    }
}

pub fn map_tcp_state(state: TcpState) -> PortStatus {
    match state {
        TcpState::Listen => PortStatus::Listening,
        TcpState::Closed | TcpState::DeleteTcb => PortStatus::Closed,
        TcpState::Unknown => PortStatus::Unknown,
        TcpState::SynSent
        | TcpState::SynReceived
        | TcpState::Established
        | TcpState::FinWait1
        | TcpState::FinWait2
        | TcpState::CloseWait
        | TcpState::Closing
        | TcpState::LastAck
        | TcpState::TimeWait => PortStatus::Active,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::net::{IpAddr, Ipv4Addr};

    #[test]
    fn maps_tcp_states_to_domain_statuses() {
        assert_eq!(map_tcp_state(TcpState::Listen), PortStatus::Listening);
        assert_eq!(map_tcp_state(TcpState::Established), PortStatus::Active);
        assert_eq!(map_tcp_state(TcpState::Closed), PortStatus::Closed);
        assert_eq!(map_tcp_state(TcpState::Unknown), PortStatus::Unknown);
    }

    #[test]
    fn maps_socket_info_to_port_record() {
        let socket = SocketInfo {
            protocol_socket_info: ProtocolSocketInfo::Tcp(netstat2::TcpSocketInfo {
                local_addr: IpAddr::V4(Ipv4Addr::new(127, 0, 0, 1)),
                local_port: 3000,
                remote_addr: IpAddr::V4(Ipv4Addr::new(127, 0, 0, 1)),
                remote_port: 4000,
                state: TcpState::Listen,
            }),
            associated_pids: vec![4242],
        };

        let record = map_socket_info(&socket, Some("node".into()));

        assert_eq!(record.port, 3000);
        assert_eq!(record.protocol, PortProtocol::Tcp);
        assert_eq!(record.listen_address, "127.0.0.1");
        assert_eq!(record.pid, Some(4242));
        assert_eq!(record.process_name.as_deref(), Some("node"));
        assert_eq!(record.status, PortStatus::Listening);
    }
}
