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

    assert_eq!(service.kind, ServiceKind::Command);
    assert!(service.expects_port(3000));
    assert!(!service.expects_port(8080));
}

#[test]
fn favorite_target_key_is_stable() {
    let favorite = Favorite::new(FavoriteTarget::Port(3000));
    assert_eq!(favorite.target.key(), "port:3000");
}

#[test]
fn port_record_carries_match_information() {
    let record = PortRecord {
        port: 5173,
        protocol: PortProtocol::Tcp,
        listen_address: "127.0.0.1".into(),
        pid: Some(1234),
        process_name: Some("node".into()),
        status: PortStatus::Listening,
        matched_service_id: None,
    };

    assert_eq!(record.port, 5173);
    assert_eq!(record.process_name.as_deref(), Some("node"));
}
