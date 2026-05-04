mod support;

use pm_application::PortManagerService;
use pm_domain::{PortProtocol, PortRecord, PortStatus};
use support::{
    InMemoryFavoriteRepository, InMemoryManagedServiceRepository, InMemoryRunStateRepository,
    RecordingCommandRunner, RecordingProcessController, RecordingProjectDetector,
    RecordingServiceController, StaticPortProvider,
};

#[tokio::test]
async fn kill_process_by_port_calls_process_controller() {
    let controller = RecordingProcessController::default();
    let service = PortManagerService::new(
        StaticPortProvider {
            ports: vec![PortRecord {
                port: 3000,
                protocol: PortProtocol::Tcp,
                listen_address: "127.0.0.1".into(),
                pid: Some(4421),
                process_name: Some("node".into()),
                status: PortStatus::Listening,
                matched_service_id: None,
            }],
        },
        controller.clone(),
        RecordingServiceController::default(),
        RecordingCommandRunner::default(),
        RecordingProjectDetector::default(),
        InMemoryFavoriteRepository::new(vec![]),
        InMemoryManagedServiceRepository::new(vec![]),
        InMemoryRunStateRepository::default(),
    );

    let pid = service
        .kill_process_by_port(3000)
        .await
        .expect("process should be killed");

    assert_eq!(pid, 4421);
    assert_eq!(
        controller
            .killed_pids
            .lock()
            .expect("killed pids")
            .as_slice(),
        &[4421]
    );
}
