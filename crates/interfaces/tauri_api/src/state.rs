use anyhow::Result;
use pm_adapters_runner::LocalCommandRunner;
use pm_adapters_runner::ProjectFileDetector;
use pm_adapters_sqlite::SqliteStore;
use pm_adapters_windows::{
    WindowsPortProvider, WindowsProcessController, WindowsServiceController,
};
use pm_application::PortManagerService;
use std::fs;
use std::path::PathBuf;
use std::sync::Arc;

pub type DesktopService = PortManagerService<
    WindowsPortProvider,
    WindowsProcessController,
    WindowsServiceController,
    LocalCommandRunner,
    ProjectFileDetector,
    SqliteStore,
    SqliteStore,
    SqliteStore,
>;

#[derive(Clone)]
pub struct AppState {
    service: Arc<DesktopService>,
}

impl AppState {
    pub fn new() -> Result<Self> {
        let store = SqliteStore::open(workspace_db_path())?;
        let service = PortManagerService::new(
            WindowsPortProvider,
            WindowsProcessController,
            WindowsServiceController,
            LocalCommandRunner,
            ProjectFileDetector,
            store.clone(),
            store.clone(),
            store,
        );

        Ok(Self {
            service: Arc::new(service),
        })
    }

    pub fn service(&self) -> &DesktopService {
        self.service.as_ref()
    }
}

fn workspace_db_path() -> PathBuf {
    let data_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../../data");
    fs::create_dir_all(&data_dir).expect("failed to create data directory");
    data_dir.join("port-manager.db")
}
