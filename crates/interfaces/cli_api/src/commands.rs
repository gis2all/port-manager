use crate::cli::{Cli, Commands, FavoriteAction, OutputFormat};
use anyhow::Result;
use pm_adapters_runner::LocalCommandRunner;
use pm_adapters_sqlite::SqliteStore;
use pm_adapters_windows::{
    WindowsPortProvider, WindowsProcessController, WindowsServiceController,
};
use pm_application::PortManagerService;
use pm_domain::FavoriteTarget;
use std::fs;
use std::path::PathBuf;

fn build_service() -> Result<
    PortManagerService<
        WindowsPortProvider,
        WindowsProcessController,
        WindowsServiceController,
        LocalCommandRunner,
        SqliteStore,
        SqliteStore,
        SqliteStore,
    >,
> {
    let store = SqliteStore::open(workspace_db_path())?;
    Ok(PortManagerService::new(
        WindowsPortProvider,
        WindowsProcessController,
        WindowsServiceController,
        LocalCommandRunner,
        store.clone(),
        store.clone(),
        store,
    ))
}

pub async fn run(cli: Cli) -> Result<String> {
    let app = build_service()?;

    match cli.command {
        Commands::ScanPorts { format } => {
            let snapshot = app.dashboard_snapshot().await?;
            match format {
                OutputFormat::Json => Ok(serde_json::to_string_pretty(&snapshot.ports)?),
                OutputFormat::Table => Ok(render_port_table(&snapshot.ports)),
            }
        }
        Commands::KillPort { port } => {
            let pid = app.kill_process_by_port(port).await?;
            Ok(format!("killed owner pid {pid} for port {port}"))
        }
        Commands::Favorite { action } => match action {
            FavoriteAction::Port { port } => {
                app.toggle_favorite(FavoriteTarget::Port(port)).await?;
                Ok(format!("toggled favorite for port {port}"))
            }
            FavoriteAction::Service { service_id } => {
                app.toggle_favorite(FavoriteTarget::Service(service_id))
                    .await?;
                Ok(format!("toggled favorite for service {service_id}"))
            }
        },
    }
}

fn render_port_table(ports: &[pm_application::PortDto]) -> String {
    let mut lines = vec!["PORT  PROTOCOL  PID    STATUS      ADDRESS".to_string()];
    for port in ports {
        lines.push(format!(
            "{:<5} {:<8} {:<6} {:<10} {}",
            port.port,
            port.protocol,
            port.pid.map(|pid| pid.to_string()).unwrap_or_else(|| "-".into()),
            port.status,
            port.listen_address
        ));
    }
    lines.join("\n")
}

fn workspace_db_path() -> PathBuf {
    let data_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../../data");
    fs::create_dir_all(&data_dir).expect("failed to create data directory");
    data_dir.join("port-manager.db")
}
