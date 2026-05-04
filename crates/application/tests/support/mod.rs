use async_trait::async_trait;
use chrono::{DateTime, Utc};
use pm_domain::{
    Favorite, FavoriteTarget, ManagedService, ManagedServiceId, ManagedServiceRun, PortRecord,
};
use pm_ports::{
    CommandRunHandle, CommandRunner, CommandStopResult, DetectedServiceCandidate,
    FavoriteRepository, ManagedServiceRepository, PortProvider, ProcessController, ProcessDetails,
    ProjectDetector, RunStateRepository, ServiceController, ServiceStatus, StartCommandRequest,
    StopCommandRequest,
};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

pub struct StaticPortProvider {
    pub ports: Vec<PortRecord>,
}

#[async_trait]
impl PortProvider for StaticPortProvider {
    async fn scan_ports(&self) -> anyhow::Result<Vec<PortRecord>> {
        Ok(self.ports.clone())
    }
}

#[derive(Default, Clone)]
pub struct RecordingProcessController {
    pub killed_pids: Arc<Mutex<Vec<u32>>>,
    pub running_pids: Arc<Mutex<HashMap<u32, bool>>>,
    pub process_details: Arc<Mutex<HashMap<u32, ProcessDetails>>>,
}

#[async_trait]
impl ProcessController for RecordingProcessController {
    async fn kill_pid(&self, pid: u32) -> anyhow::Result<()> {
        self.killed_pids.lock().expect("killed pids").push(pid);
        Ok(())
    }

    async fn is_pid_running(&self, pid: u32) -> anyhow::Result<bool> {
        Ok(*self
            .running_pids
            .lock()
            .expect("running pids")
            .get(&pid)
            .unwrap_or(&false))
    }

    async fn get_process_details(&self, pid: u32) -> anyhow::Result<Option<ProcessDetails>> {
        Ok(self
            .process_details
            .lock()
            .expect("process details")
            .get(&pid)
            .cloned())
    }
}

#[derive(Default, Clone)]
pub struct RecordingServiceController {
    pub started_services: Arc<Mutex<Vec<String>>>,
    pub stopped_services: Arc<Mutex<Vec<String>>>,
    pub statuses: Arc<Mutex<HashMap<String, ServiceStatus>>>,
}

impl RecordingServiceController {
    pub fn set_status(&self, service_name: impl Into<String>, status: ServiceStatus) {
        self.statuses
            .lock()
            .expect("statuses")
            .insert(service_name.into(), status);
    }
}

#[async_trait]
impl ServiceController for RecordingServiceController {
    async fn start(&self, service_name: &str) -> anyhow::Result<()> {
        self.started_services
            .lock()
            .expect("started services")
            .push(service_name.to_owned());
        self.set_status(service_name, ServiceStatus::Running);
        Ok(())
    }

    async fn stop(&self, service_name: &str) -> anyhow::Result<()> {
        self.stopped_services
            .lock()
            .expect("stopped services")
            .push(service_name.to_owned());
        self.set_status(service_name, ServiceStatus::Stopped);
        Ok(())
    }

    async fn status(&self, service_name: &str) -> anyhow::Result<ServiceStatus> {
        Ok(self
            .statuses
            .lock()
            .expect("statuses")
            .get(service_name)
            .cloned()
            .unwrap_or(ServiceStatus::Unknown))
    }
}

#[derive(Default, Clone)]
pub struct RecordingCommandRunner {
    pub started_commands: Arc<Mutex<Vec<StartCommandRequest>>>,
    pub stop_requests: Arc<Mutex<Vec<StopCommandRequest>>>,
    pub next_pid: Arc<Mutex<u32>>,
    pub next_stop_result: Arc<Mutex<Option<CommandStopResult>>>,
}

#[async_trait]
impl CommandRunner for RecordingCommandRunner {
    async fn start(&self, request: StartCommandRequest) -> anyhow::Result<CommandRunHandle> {
        self.started_commands
            .lock()
            .expect("started commands")
            .push(request);

        let mut next_pid = self.next_pid.lock().expect("next pid");
        if *next_pid == 0 {
            *next_pid = 4100;
        }
        let root_pid = *next_pid;
        *next_pid += 1;

        Ok(CommandRunHandle {
            root_pid,
            child_pids: vec![root_pid + 1],
            log_path: Some("logs/service.log".into()),
        })
    }

    async fn stop(&self, request: StopCommandRequest) -> anyhow::Result<CommandStopResult> {
        self.stop_requests.lock().expect("stop requests").push(request);
        Ok(self
            .next_stop_result
            .lock()
            .expect("next stop result")
            .clone()
            .unwrap_or(CommandStopResult {
                child_pids: vec![],
                last_exit_code: Some(0),
            }))
    }
}

#[derive(Default, Clone)]
pub struct RecordingProjectDetector {
    pub candidates: Arc<Mutex<HashMap<String, Vec<DetectedServiceCandidate>>>>,
}

impl RecordingProjectDetector {
    #[allow(dead_code)]
    pub fn set_candidates(
        &self,
        root: impl Into<String>,
        candidates: Vec<DetectedServiceCandidate>,
    ) {
        self.candidates
            .lock()
            .expect("candidates")
            .insert(root.into(), candidates);
    }
}

#[async_trait]
impl ProjectDetector for RecordingProjectDetector {
    async fn detect(&self, root: &str) -> anyhow::Result<Vec<DetectedServiceCandidate>> {
        Ok(self
            .candidates
            .lock()
            .expect("candidates")
            .get(root)
            .cloned()
            .unwrap_or_default())
    }
}

pub struct InMemoryFavoriteRepository {
    favorites: Mutex<Vec<Favorite>>,
}

impl InMemoryFavoriteRepository {
    pub fn new(favorites: Vec<Favorite>) -> Self {
        Self {
            favorites: Mutex::new(favorites),
        }
    }
}

#[async_trait]
impl FavoriteRepository for InMemoryFavoriteRepository {
    async fn list(&self) -> anyhow::Result<Vec<Favorite>> {
        Ok(self.favorites.lock().expect("favorites").clone())
    }

    async fn upsert(&self, favorite: Favorite) -> anyhow::Result<()> {
        let mut favorites = self.favorites.lock().expect("favorites");
        if let Some(existing) = favorites
            .iter_mut()
            .find(|existing| existing.target == favorite.target)
        {
            *existing = favorite;
        } else {
            favorites.push(favorite);
        }
        Ok(())
    }

    async fn delete(&self, target: &FavoriteTarget) -> anyhow::Result<()> {
        let mut favorites = self.favorites.lock().expect("favorites");
        favorites.retain(|favorite| &favorite.target != target);
        Ok(())
    }
}

pub struct InMemoryManagedServiceRepository {
    services: Mutex<Vec<ManagedService>>,
}

impl InMemoryManagedServiceRepository {
    pub fn new(services: Vec<ManagedService>) -> Self {
        Self {
            services: Mutex::new(services),
        }
    }
}

#[async_trait]
impl ManagedServiceRepository for InMemoryManagedServiceRepository {
    async fn list(&self) -> anyhow::Result<Vec<ManagedService>> {
        Ok(self.services.lock().expect("services").clone())
    }

    async fn get(&self, id: ManagedServiceId) -> anyhow::Result<Option<ManagedService>> {
        Ok(self
            .services
            .lock()
            .expect("services")
            .iter()
            .find(|existing| existing.id() == id)
            .cloned())
    }

    async fn save(&self, service: ManagedService) -> anyhow::Result<()> {
        let mut services = self.services.lock().expect("services");
        if let Some(index) = services
            .iter()
            .position(|existing| existing.id() == service.id())
        {
            services[index] = service;
        } else {
            services.push(service);
        }
        Ok(())
    }

    async fn delete(&self, id: ManagedServiceId) -> anyhow::Result<()> {
        let mut services = self.services.lock().expect("services");
        services.retain(|service| service.id() != id);
        Ok(())
    }
}

#[derive(Default, Clone)]
pub struct InMemoryRunStateRepository {
    runs: Arc<Mutex<HashMap<ManagedServiceId, ManagedServiceRun>>>,
}

#[async_trait]
impl RunStateRepository for InMemoryRunStateRepository {
    async fn get(&self, service_id: ManagedServiceId) -> anyhow::Result<Option<ManagedServiceRun>> {
        Ok(self
            .runs
            .lock()
            .expect("runs")
            .get(&service_id)
            .cloned())
    }

    async fn save(&self, run: ManagedServiceRun) -> anyhow::Result<()> {
        self.runs
            .lock()
            .expect("runs")
            .insert(run.service_id, run);
        Ok(())
    }
}

#[allow(dead_code)]
pub fn process_details(
    pid: u32,
    executable_path: Option<&str>,
    started_at: Option<DateTime<Utc>>,
    working_set_bytes: Option<u64>,
    private_bytes: Option<u64>,
    vendor: Option<&str>,
    file_version: Option<&str>,
    digital_signature: Option<&str>,
) -> ProcessDetails {
    ProcessDetails {
        pid,
        executable_path: executable_path.map(ToOwned::to_owned),
        started_at,
        working_set_bytes,
        private_bytes,
        vendor: vendor.map(ToOwned::to_owned),
        file_version: file_version.map(ToOwned::to_owned),
        digital_signature: digital_signature.map(ToOwned::to_owned),
    }
}
