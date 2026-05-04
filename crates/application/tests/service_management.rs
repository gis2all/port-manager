mod support;

use chrono::Utc;
use pm_application::{ManagedServiceDraftDto, PortManagerService};
use pm_domain::ManagedService;
use pm_ports::{DetectedServiceCandidate, RunStateRepository, ServiceStatus};
use std::fs;
use support::{
    InMemoryFavoriteRepository, InMemoryManagedServiceRepository, InMemoryRunStateRepository,
    RecordingCommandRunner, RecordingProcessController, RecordingProjectDetector,
    RecordingServiceController, StaticPortProvider, process_details,
};

#[tokio::test]
async fn save_managed_service_registers_and_deletes_services() {
    let app = PortManagerService::new(
        StaticPortProvider { ports: vec![] },
        RecordingProcessController::default(),
        RecordingServiceController::default(),
        RecordingCommandRunner::default(),
        RecordingProjectDetector::default(),
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
            stop_command: Some("npm run stop".into()),
            auto_detected_from: Some("package.json".into()),
            expected_ports: vec![3000],
        })
        .await
        .expect("save service");

    let snapshot = app.dashboard_snapshot().await.expect("snapshot");
    assert_eq!(snapshot.services.len(), 1);
    assert_eq!(snapshot.services[0].id, service_id);
    assert_eq!(snapshot.services[0].stop_command.as_deref(), Some("npm run stop"));
    assert_eq!(snapshot.services[0].auto_detected_from.as_deref(), Some("package.json"));

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
    let process_controller = RecordingProcessController::default();
    process_controller
        .running_pids
        .lock()
        .expect("running pids")
        .insert(4100, true);

    let app = PortManagerService::new(
        StaticPortProvider { ports: vec![] },
        process_controller,
        controller,
        runner.clone(),
        RecordingProjectDetector::default(),
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
        runner.started_commands.lock().expect("starts")[0].service_name,
        "web"
    );
    assert_eq!(
        runner.started_commands.lock().expect("starts")[0].service_id,
        service.id().to_string()
    );
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
    assert_eq!(runner.stop_requests.lock().expect("stops").len(), 1);
    assert_eq!(runner.stop_requests.lock().expect("stops")[0].root_pid, 4100);
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
        RecordingProjectDetector::default(),
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

#[tokio::test]
async fn command_service_status_is_corrected_when_root_pid_is_not_running() {
    let service = ManagedService::command("web", "npm run dev", Some("D:/Code/web".into()), vec![3000]);
    let run_state = InMemoryRunStateRepository::default();
    run_state
        .save(pm_domain::ManagedServiceRun {
            service_id: service.id(),
            status: pm_domain::ServiceRunStatus::Running,
            root_pid: Some(4100),
            child_pids: vec![4101],
            started_at: Some(Utc::now()),
            last_exit_code: None,
            log_path: Some("data/logs/web.log".into()),
            ownership: pm_domain::RunOwnership::Managed,
        })
        .await
        .expect("seed run");

    let process_controller = RecordingProcessController::default();
    process_controller
        .running_pids
        .lock()
        .expect("running pids")
        .insert(4100, false);

    let app = PortManagerService::new(
        StaticPortProvider { ports: vec![] },
        process_controller,
        RecordingServiceController::default(),
        RecordingCommandRunner::default(),
        RecordingProjectDetector::default(),
        InMemoryFavoriteRepository::new(vec![]),
        InMemoryManagedServiceRepository::new(vec![service.clone()]),
        run_state.clone(),
    );

    let snapshot = app.dashboard_snapshot().await.expect("snapshot");
    assert_eq!(snapshot.services[0].status, "stopped");
    assert_eq!(
        run_state
            .get(service.id())
            .await
            .expect("run state")
            .expect("corrected run")
            .root_pid,
        None
    );
}

#[tokio::test]
async fn get_port_process_detail_returns_only_real_collected_fields() {
    let process_controller = RecordingProcessController::default();
    let started_at = Utc::now();
    process_controller
        .process_details
        .lock()
        .expect("process details")
        .insert(
            5521,
            process_details(
                5521,
                Some("C:/Tools/node.exe"),
                Some(started_at),
                Some(64 * 1024 * 1024),
                Some(96 * 1024 * 1024),
                Some("OpenJS Foundation"),
                Some("22.3.0"),
                Some("Valid"),
            ),
        );

    let app = PortManagerService::new(
        StaticPortProvider { ports: vec![] },
        process_controller,
        RecordingServiceController::default(),
        RecordingCommandRunner::default(),
        RecordingProjectDetector::default(),
        InMemoryFavoriteRepository::new(vec![]),
        InMemoryManagedServiceRepository::new(vec![]),
        InMemoryRunStateRepository::default(),
    );

    let detail = app
        .get_port_process_detail(5521, Some("node.exe".into()))
        .await
        .expect("process detail");

    assert_eq!(detail.pid, 5521);
    assert_eq!(detail.process_name.as_deref(), Some("node.exe"));
    assert_eq!(detail.executable_path.as_deref(), Some("C:/Tools/node.exe"));
    assert_eq!(detail.vendor.as_deref(), Some("OpenJS Foundation"));
    assert_eq!(detail.file_version.as_deref(), Some("22.3.0"));
    assert_eq!(detail.digital_signature.as_deref(), Some("Valid"));
    assert_eq!(detail.started_at, Some(started_at));
    assert_eq!(detail.working_set_bytes, Some(64 * 1024 * 1024));
    assert_eq!(detail.private_bytes, Some(96 * 1024 * 1024));
}

#[tokio::test]
async fn detect_project_services_returns_candidates_for_existing_path() {
    let temp_dir = tempfile::tempdir().expect("tempdir");
    let temp_root = temp_dir.path().to_string_lossy().into_owned();
    fs::write(temp_dir.path().join("package.json"), "{\"name\":\"demo\"}").expect("seed file");

    let detector = RecordingProjectDetector::default();
    detector.set_candidates(
        temp_root.clone(),
        vec![DetectedServiceCandidate {
            name: "demo".into(),
            start_command: "npm run dev".into(),
            workdir: temp_root.clone(),
            expected_ports: vec![3000, 5173],
            detected_from: "package.json".into(),
        }],
    );

    let app = PortManagerService::new(
        StaticPortProvider { ports: vec![] },
        RecordingProcessController::default(),
        RecordingServiceController::default(),
        RecordingCommandRunner::default(),
        detector,
        InMemoryFavoriteRepository::new(vec![]),
        InMemoryManagedServiceRepository::new(vec![]),
        InMemoryRunStateRepository::default(),
    );

    let candidates = app
        .detect_project_services(&temp_root)
        .await
        .expect("detect project");

    assert_eq!(candidates.len(), 1);
    assert_eq!(candidates[0].name, "demo");
    assert_eq!(candidates[0].start_command, "npm run dev");
    assert_eq!(candidates[0].expected_ports, vec![3000, 5173]);
    assert_eq!(candidates[0].detected_from, "package.json");
}
