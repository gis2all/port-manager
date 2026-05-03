mod support;

use pm_application::{ManagedServiceDraftDto, PortManagerService};
use pm_domain::ManagedService;
use pm_ports::{RunStateRepository, ServiceStatus};
use support::{
    InMemoryFavoriteRepository, InMemoryManagedServiceRepository, InMemoryRunStateRepository,
    RecordingCommandRunner, RecordingProcessController, RecordingServiceController,
    StaticPortProvider,
};

#[tokio::test]
async fn save_managed_service_registers_and_deletes_services() {
    let app = PortManagerService::new(
        StaticPortProvider { ports: vec![] },
        RecordingProcessController::default(),
        RecordingServiceController::default(),
        RecordingCommandRunner::default(),
        InMemoryFavoriteRepository::new(vec![]),
        InMemoryManagedServiceRepository::new(vec![]),
        InMemoryRunStateRepository::default(),
    );

    let service_id = app
        .save_managed_service(ManagedServiceDraftDto {
            name: "web".into(),
            kind: "command".into(),
            service_name: None,
            workdir: Some("D:/Code/example".into()),
            start_command: Some("npm run dev".into()),
            expected_ports: vec![3000],
        })
        .await
        .expect("save service");

    let snapshot = app.dashboard_snapshot().await.expect("snapshot");
    assert_eq!(snapshot.services.len(), 1);
    assert_eq!(snapshot.services[0].id, service_id);

    app.delete_managed_service(service_id)
        .await
        .expect("delete service");

    let snapshot = app.dashboard_snapshot().await.expect("snapshot");
    assert!(snapshot.services.is_empty());
}

#[tokio::test]
async fn command_services_start_and_stop_through_runner() {
    let service = ManagedService::command("web", "npm run dev", Some("D:/Code/web".into()), vec![3000]);
    let controller = RecordingServiceController::default();
    let runner = RecordingCommandRunner::default();
    let run_state = InMemoryRunStateRepository::default();

    let app = PortManagerService::new(
        StaticPortProvider { ports: vec![] },
        RecordingProcessController::default(),
        controller,
        runner.clone(),
        InMemoryFavoriteRepository::new(vec![]),
        InMemoryManagedServiceRepository::new(vec![service.clone()]),
        run_state.clone(),
    );

    app.start_managed_service(service.id())
        .await
        .expect("start command service");

    let snapshot = app.dashboard_snapshot().await.expect("snapshot");
    assert_eq!(snapshot.services[0].status, "running");
    assert_eq!(runner.started_commands.lock().expect("starts").len(), 1);
    assert_eq!(
        run_state
            .get(service.id())
            .await
            .expect("run state")
            .expect("run should exist")
            .status,
        pm_domain::ServiceRunStatus::Running
    );

    app.stop_managed_service(service.id())
        .await
        .expect("stop command service");

    let snapshot = app.dashboard_snapshot().await.expect("snapshot");
    assert_eq!(snapshot.services[0].status, "stopped");
    assert_eq!(runner.stopped_root_pids.lock().expect("stops").as_slice(), &[4100]);
    assert_eq!(
        run_state
            .get(service.id())
            .await
            .expect("run state")
            .expect("run should exist")
            .status,
        pm_domain::ServiceRunStatus::Stopped
    );
}

#[tokio::test]
async fn windows_services_start_and_stop_through_controller() {
    let service = ManagedService::windows_service("postgres", "postgresql-x64-17", vec![5432]);
    let controller = RecordingServiceController::default();
    controller.set_status("postgresql-x64-17", ServiceStatus::Stopped);

    let app = PortManagerService::new(
        StaticPortProvider { ports: vec![] },
        RecordingProcessController::default(),
        controller.clone(),
        RecordingCommandRunner::default(),
        InMemoryFavoriteRepository::new(vec![]),
        InMemoryManagedServiceRepository::new(vec![service.clone()]),
        InMemoryRunStateRepository::default(),
    );

    app.start_managed_service(service.id())
        .await
        .expect("start windows service");

    let snapshot = app.dashboard_snapshot().await.expect("snapshot");
    assert_eq!(snapshot.services[0].status, "running");
    assert_eq!(
        controller.started_services.lock().expect("starts").as_slice(),
        &["postgresql-x64-17".to_string()]
    );

    app.stop_managed_service(service.id())
        .await
        .expect("stop windows service");

    let snapshot = app.dashboard_snapshot().await.expect("snapshot");
    assert_eq!(snapshot.services[0].status, "stopped");
    assert_eq!(
        controller.stopped_services.lock().expect("stops").as_slice(),
        &["postgresql-x64-17".to_string()]
    );
}
