use pm_application::PortManagerService;
use pm_domain::{Favorite, FavoriteTarget, ManagedService, PortProtocol, PortRecord, PortStatus};

#[test]
fn dashboard_snapshot_marks_favorites_and_service_matches() {
    let ports = vec![PortRecord {
        port: 3000,
        protocol: PortProtocol::Tcp,
        listen_address: "127.0.0.1".into(),
        pid: Some(4421),
        process_name: Some("node".into()),
        status: PortStatus::Listening,
        matched_service_id: None,
    }];

    let service = ManagedService::command(
        "web",
        "npm run dev",
        Some("D:/Code/example".into()),
        vec![3000],
    );

    let favorites = vec![Favorite::new(FavoriteTarget::Port(3000))];

    let snapshot = PortManagerService::new_for_tests(ports, vec![service], favorites)
        .dashboard_snapshot()
        .expect("snapshot should build");

    assert_eq!(snapshot.ports.len(), 1);
    assert!(snapshot.ports[0].is_favorite);
    assert_eq!(snapshot.ports[0].matched_service_name.as_deref(), Some("web"));
    assert_eq!(snapshot.services[0].expected_ports, vec![3000]);
}
