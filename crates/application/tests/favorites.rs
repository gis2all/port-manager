mod support;

use pm_application::PortManagerService;
use pm_domain::{FavoriteTarget, ManagedService};
use support::{
    InMemoryFavoriteRepository, InMemoryManagedServiceRepository, InMemoryRunStateRepository,
    RecordingCommandRunner, RecordingProcessController, RecordingProjectDetector,
    RecordingServiceController, StaticPortProvider,
};

#[tokio::test]
async fn toggle_favorite_updates_dashboard_snapshot() {
    let service = ManagedService::command("web", "npm run dev", None, vec![3000]);
    let service_id = service.id();

    let app = PortManagerService::new(
        StaticPortProvider { ports: vec![] },
        RecordingProcessController::default(),
        RecordingServiceController::default(),
        RecordingCommandRunner::default(),
        RecordingProjectDetector::default(),
        InMemoryFavoriteRepository::new(vec![]),
        InMemoryManagedServiceRepository::new(vec![service]),
        InMemoryRunStateRepository::default(),
    );

    app.toggle_favorite(FavoriteTarget::Service(service_id))
        .await
        .expect("toggle favorite");

    let snapshot = app.dashboard_snapshot().await.expect("snapshot");
    assert!(snapshot.services[0].is_favorite);
}
