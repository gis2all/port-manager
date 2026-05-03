use async_trait::async_trait;
use pm_domain::{
    Favorite, FavoriteTarget, ManagedService, ManagedServiceId, ManagedServiceRun, PortRecord,
};
use pm_ports::{
    CommandRunHandle, CommandRunner, FavoriteRepository, ManagedServiceRepository, PortProvider,
    ProcessController, RunStateRepository, ServiceController, ServiceStatus, StartCommandRequest,
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
}

#[async_trait]
impl ProcessController for RecordingProcessController {
    async fn kill_pid(&self, pid: u32) -> anyhow::Result<()> {
        self.killed_pids.lock().expect("killed pids").push(pid);
        Ok(())
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
    pub stopped_root_pids: Arc<Mutex<Vec<u32>>>,
    pub next_pid: Arc<Mutex<u32>>,
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

    async fn stop(&self, root_pid: u32) -> anyhow::Result<()> {
        self.stopped_root_pids
            .lock()
            .expect("stopped root pids")
            .push(root_pid);
        Ok(())
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
