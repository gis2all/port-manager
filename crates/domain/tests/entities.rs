use pm_domain::{
    Favorite,
    FavoriteTarget,
    ManagedService,
    PortProtocol,
    PortRecord,
    PortStatus,
    ServiceKind,
};

#[test]
fn command_service_reports_expected_ports() {
    let service = ManagedService::command(
        "web",
        "npm run dev",
        Some("D:/Code/example".into()),
        vec![3000, 5173],
    );

    assert_eq!(service.kind(), &ServiceKind::Command);
    assert_eq!(service.name(), "web");
    assert_eq!(service.workdir(), Some("D:/Code/example"));
    assert_eq!(service.start_command(), Some("npm run dev"));
    assert_eq!(service.stop_command(), None);
    assert_eq!(service.service_name(), None);
    assert_eq!(service.expected_ports(), &[3000, 5173]);
    assert!(service.expects_port(3000));
    assert!(!service.expects_port(8080));
}

#[test]
fn favorite_target_key_is_stable() {
    let favorite = Favorite::new(FavoriteTarget::Port(3000));
    assert_eq!(favorite.target.key(), "port:3000");
}

#[test]
fn favorite_service_target_key_is_stable() {
    let service = ManagedService::command("web", "npm run dev", None, vec![3000]);
    let favorite = Favorite::new(FavoriteTarget::Service(service.id()));

    assert_eq!(favorite.target.key(), format!("service:{}", service.id()));
}

#[test]
fn windows_service_populates_service_specific_fields() {
    let service = ManagedService::windows_service("postgres", "postgresql-x64-17", vec![5432]);

    assert_eq!(service.kind(), &ServiceKind::WindowsService);
    assert_eq!(service.name(), "postgres");
    assert_eq!(service.service_name(), Some("postgresql-x64-17"));
    assert_eq!(service.workdir(), None);
    assert_eq!(service.start_command(), None);
    assert_eq!(service.stop_command(), None);
    assert_eq!(service.expected_ports(), &[5432]);
}

#[test]
fn port_record_carries_match_information() {
    let service = ManagedService::command("vite", "npm run dev", None, vec![5173]);
    let record = PortRecord {
        port: 5173,
        protocol: PortProtocol::Tcp,
        listen_address: "127.0.0.1".into(),
        pid: Some(1234),
        process_name: Some("node".into()),
        status: PortStatus::Listening,
        matched_service_id: Some(service.id()),
    };

    assert_eq!(record.port, 5173);
    assert_eq!(record.process_name.as_deref(), Some("node"));
    assert_eq!(record.matched_service_id, Some(service.id()));
}
