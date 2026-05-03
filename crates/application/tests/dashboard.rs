mod support;

use pm_application::PortManagerService;
use pm_domain::{Favorite, FavoriteTarget, ManagedService, PortProtocol, PortRecord, PortStatus};
use support::{
    InMemoryFavoriteRepository, InMemoryManagedServiceRepository, InMemoryRunStateRepository,
    RecordingCommandRunner, RecordingProcessController, RecordingServiceController,
    StaticPortProvider,
};

#[tokio::test]
async fn dashboard_snapshot_marks_favorites_and_service_matches() {
    let service = ManagedService::command(
        "web",
        "npm run dev",
        Some("D:/Code/example".into()),
        vec![3000],
    );
    let service_id = service.id();

    let ports = vec![PortRecord {
        port: 3000,
        protocol: PortProtocol::Tcp,
        listen_address: "127.0.0.1".into(),
        pid: Some(4421),
        process_name: Some("node".into()),
        status: PortStatus::Listening,
        matched_service_id: Some(service_id),
    }];

    let favorites = vec![
        Favorite::new(FavoriteTarget::Port(3000)),
        Favorite::new(FavoriteTarget::Service(service_id)),
    ];

    let snapshot = PortManagerService::new(
        StaticPortProvider { ports },
        RecordingProcessController::default(),
        RecordingServiceController::default(),
        RecordingCommandRunner::default(),
        InMemoryFavoriteRepository::new(favorites),
        InMemoryManagedServiceRepository::new(vec![service]),
        InMemoryRunStateRepository::default(),
    )
        .dashboard_snapshot()
        .await
        .expect("snapshot should build");

    assert_eq!(snapshot.ports.len(), 1);
    assert!(snapshot.ports[0].is_favorite);
    assert_eq!(snapshot.ports[0].matched_service_name.as_deref(), Some("web"));
    assert_eq!(snapshot.services[0].expected_ports, vec![3000]);
    assert!(snapshot.services[0].is_favorite);
}

#[tokio::test]
async fn dashboard_snapshot_prefers_explicit_service_match_before_port_guessing() {
    let explicit_service = ManagedService::command("api", "pnpm api", None, vec![4000]);
    let guessed_service = ManagedService::command("web", "pnpm web", None, vec![3000]);

    let snapshot = PortManagerService::new(
        StaticPortProvider {
            ports: vec![PortRecord {
                port: 3000,
                protocol: PortProtocol::Tcp,
                listen_address: "127.0.0.1".into(),
                pid: Some(5512),
                process_name: Some("node".into()),
                status: PortStatus::Listening,
                matched_service_id: Some(explicit_service.id()),
            }],
        },
        RecordingProcessController::default(),
        RecordingServiceController::default(),
        RecordingCommandRunner::default(),
        InMemoryFavoriteRepository::new(vec![]),
        InMemoryManagedServiceRepository::new(vec![explicit_service.clone(), guessed_service]),
        InMemoryRunStateRepository::default(),
    )
    .dashboard_snapshot()
    .await
    .expect("snapshot should prefer explicit service id");

    assert_eq!(snapshot.ports[0].matched_service_id, Some(explicit_service.id()));
    assert_eq!(snapshot.ports[0].matched_service_name.as_deref(), Some("api"));
}

#[tokio::test]
async fn dashboard_snapshot_falls_back_to_expected_port_matching() {
    let snapshot = PortManagerService::new(
        StaticPortProvider {
            ports: vec![PortRecord {
                port: 5173,
                protocol: PortProtocol::Tcp,
                listen_address: "127.0.0.1".into(),
                pid: Some(6001),
                process_name: Some("node".into()),
                status: PortStatus::Listening,
                matched_service_id: None,
            }],
        },
        RecordingProcessController::default(),
        RecordingServiceController::default(),
        RecordingCommandRunner::default(),
        InMemoryFavoriteRepository::new(vec![]),
        InMemoryManagedServiceRepository::new(vec![ManagedService::command(
            "frontend",
            "pnpm dev",
            None,
            vec![5173],
        )]),
        InMemoryRunStateRepository::default(),
    )
    .dashboard_snapshot()
    .await
    .expect("snapshot should fall back to expected ports");

    assert_eq!(
        snapshot.ports[0].matched_service_name.as_deref(),
        Some("frontend")
    );
}
