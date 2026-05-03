use async_trait::async_trait;
use pm_application::PortManagerService;
use pm_domain::{PortProtocol, PortRecord, PortStatus};
use pm_ports::ProcessController;
use std::sync::{Arc, Mutex};

#[derive(Default)]
struct RecordingProcessController {
    killed_pids: Mutex<Vec<u32>>,
}

#[async_trait]
impl ProcessController for RecordingProcessController {
    async fn kill_pid(&self, pid: u32) -> anyhow::Result<()> {
        self.killed_pids.lock().expect("killed pids").push(pid);
        Ok(())
    }
}

#[tokio::test]
async fn kill_process_by_port_calls_process_controller() {
    let controller = Arc::new(RecordingProcessController::default());
    let service = PortManagerService::new_for_tests_with_process_controller(
        vec![PortRecord {
            port: 3000,
            protocol: PortProtocol::Tcp,
            listen_address: "127.0.0.1".into(),
            pid: Some(4421),
            process_name: Some("node".into()),
            status: PortStatus::Listening,
            matched_service_id: None,
        }],
        vec![],
        vec![],
        controller.clone(),
    );

    let pid = service
        .kill_process_by_port(3000)
        .await
        .expect("process should be killed");

    assert_eq!(pid, 4421);
    assert_eq!(
        controller.killed_pids.lock().expect("killed pids").as_slice(),
        &[4421]
    );
}
