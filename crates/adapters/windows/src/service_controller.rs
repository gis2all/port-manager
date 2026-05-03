use anyhow::Result;
use async_trait::async_trait;
use pm_ports::{ServiceController, ServiceStatus};

#[cfg(windows)]
use windows_service::service::{ServiceAccess, ServiceState};
#[cfg(windows)]
use windows_service::service_manager::{ServiceManager, ServiceManagerAccess};
#[cfg(not(windows))]
use anyhow::bail;

pub struct WindowsServiceController;

#[cfg(windows)]
fn open_service(service_name: &str) -> Result<windows_service::service::Service> {
    let manager = ServiceManager::local_computer(None::<&str>, ServiceManagerAccess::CONNECT)?;
    Ok(manager.open_service(
        service_name,
        ServiceAccess::QUERY_STATUS | ServiceAccess::START | ServiceAccess::STOP,
    )?)
}

#[cfg(windows)]
fn map_status(state: ServiceState) -> ServiceStatus {
    match state {
        ServiceState::Running => ServiceStatus::Running,
        ServiceState::Stopped => ServiceStatus::Stopped,
        ServiceState::StartPending | ServiceState::StopPending => ServiceStatus::Starting,
        _ => ServiceStatus::Unknown,
    }
}

#[cfg(windows)]
#[async_trait]
impl ServiceController for WindowsServiceController {
    async fn start(&self, service_name: &str) -> Result<()> {
        let empty_args: [&std::ffi::OsStr; 0] = [];
        open_service(service_name)?.start(&empty_args)?;
        Ok(())
    }

    async fn stop(&self, service_name: &str) -> Result<()> {
        open_service(service_name)?.stop()?;
        Ok(())
    }

    async fn status(&self, service_name: &str) -> Result<ServiceStatus> {
        let status = open_service(service_name)?.query_status()?;
        Ok(map_status(status.current_state))
    }
}

#[cfg(not(windows))]
#[async_trait]
impl ServiceController for WindowsServiceController {
    async fn start(&self, _service_name: &str) -> Result<()> {
        bail!("Windows services are only available on Windows")
    }

    async fn stop(&self, _service_name: &str) -> Result<()> {
        bail!("Windows services are only available on Windows")
    }

    async fn status(&self, _service_name: &str) -> Result<ServiceStatus> {
        bail!("Windows services are only available on Windows")
    }
}
