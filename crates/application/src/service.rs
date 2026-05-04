use crate::dto::{
    DashboardSnapshotDto, DetectedServiceCandidateDto, ManagedServiceDraftDto, ManagedServiceDto,
    PortDto, ProcessDetailDto,
};
use crate::errors::ApplicationError;
use anyhow::Result;
use chrono::Utc;
use pm_domain::{
    Favorite, FavoriteTarget, ManagedService, ManagedServiceId, ManagedServiceRun,
    PortProtocol, PortRecord, PortStatus, RunOwnership, ServiceKind, ServiceRunStatus,
};
use pm_ports::{
    CommandRunner, DetectedServiceCandidate, FavoriteRepository, ManagedServiceRepository,
    PortProvider, ProcessController, ProjectDetector, RunStateRepository, ServiceController,
    StartCommandRequest, StopCommandRequest,
};
use std::collections::{BTreeSet, HashMap, HashSet};
use std::path::Path;
use uuid::Uuid;

fn port_row_key(port: &PortRecord, matched_service_id: Option<ManagedServiceId>) -> String {
    [
        port.port.to_string(),
        match port.protocol {
            PortProtocol::Tcp => "tcp".to_owned(),
            PortProtocol::Udp => "udp".to_owned(),
        },
        port.listen_address.clone(),
        port.pid
            .map(|pid| pid.to_string())
            .unwrap_or_else(|| "null".to_owned()),
        port.process_name.clone().unwrap_or_default(),
        matched_service_id
            .map(|service_id| service_id.to_string())
            .unwrap_or_default(),
    ]
    .join("|")
}

pub struct PortManagerService<P, PC, SC, CR, PD, FR, MR, RR> {
    port_provider: P,
    process_controller: PC,
    service_controller: SC,
    command_runner: CR,
    project_detector: PD,
    favorite_repository: FR,
    managed_service_repository: MR,
    run_state_repository: RR,
}

impl<P, PC, SC, CR, PD, FR, MR, RR> PortManagerService<P, PC, SC, CR, PD, FR, MR, RR>
where
    P: PortProvider,
    PC: ProcessController,
    SC: ServiceController,
    CR: CommandRunner,
    PD: ProjectDetector,
    FR: FavoriteRepository,
    MR: ManagedServiceRepository,
    RR: RunStateRepository,
{
    pub fn new(
        port_provider: P,
        process_controller: PC,
        service_controller: SC,
        command_runner: CR,
        project_detector: PD,
        favorite_repository: FR,
        managed_service_repository: MR,
        run_state_repository: RR,
    ) -> Self {
        Self {
            port_provider,
            process_controller,
            service_controller,
            command_runner,
            project_detector,
            favorite_repository,
            managed_service_repository,
            run_state_repository,
        }
    }

    pub async fn dashboard_snapshot(&self) -> Result<DashboardSnapshotDto> {
        let ports = self.port_provider.scan_ports().await?;
        let services = self.managed_service_repository.list().await?;
        let favorites = self.favorite_repository.list().await?;
        let port_counts = ports.iter().fold(HashMap::new(), |mut counts, port| {
            *counts.entry(port.port).or_insert(0usize) += 1;
            counts
        });
        let port_row_favorites = favorites
            .iter()
            .filter_map(|favorite| match &favorite.target {
                FavoriteTarget::PortRow { key, .. } => Some(key.clone()),
                _ => None,
            })
            .collect::<HashSet<_>>();
        let legacy_port_favorites = favorites
            .iter()
            .filter_map(|favorite| match favorite.target {
                FavoriteTarget::Port(port) => Some(port),
                _ => None,
            })
            .collect::<HashSet<_>>();

        let services_by_id: HashMap<ManagedServiceId, _> = services
            .iter()
            .map(|service| (service.id(), service))
            .collect();
        let mut ports_by_service: HashMap<ManagedServiceId, BTreeSet<u16>> = HashMap::new();

        let mut port_rows = Vec::with_capacity(ports.len());
        for port in &ports {
            let matched = port
                .matched_service_id
                .and_then(|service_id| services_by_id.get(&service_id).copied())
                .or_else(|| services.iter().find(|service| service.expects_port(port.port)));

            if let Some(service) = matched {
                ports_by_service
                    .entry(service.id())
                    .or_default()
                    .insert(port.port);
            }

            let matched_service_id = matched.map(|service| service.id());
            let row_key = port_row_key(port, matched_service_id);
            let is_legacy_favorite = port_counts.get(&port.port).copied().unwrap_or_default() == 1
                && legacy_port_favorites.contains(&port.port);

            port_rows.push(PortDto {
                port: port.port,
                protocol: match port.protocol {
                    PortProtocol::Tcp => "tcp".into(),
                    PortProtocol::Udp => "udp".into(),
                },
                listen_address: port.listen_address.clone(),
                pid: port.pid,
                process_name: port.process_name.clone(),
                status: match port.status {
                    PortStatus::Listening => "listening".into(),
                    PortStatus::Active => "active".into(),
                    PortStatus::Closed => "closed".into(),
                    PortStatus::Unknown => "unknown".into(),
                },
                is_favorite: port_row_favorites.contains(&row_key) || is_legacy_favorite,
                matched_service_id,
                matched_service_name: matched.map(|service| service.name().to_owned()),
            });
        }

        let mut service_rows = Vec::with_capacity(services.len());
        for service in &services {
            let mut observed_ports = ports_by_service
                .get(&service.id())
                .map(|ports| ports.iter().copied().collect::<Vec<_>>())
                .unwrap_or_default();
            observed_ports.sort_unstable();
            observed_ports.dedup();

            let status = match service.kind() {
                ServiceKind::WindowsService => match service.service_name() {
                    Some(service_name) => match self.service_controller.status(service_name).await {
                        Ok(pm_ports::ServiceStatus::Running) => "running".into(),
                        Ok(pm_ports::ServiceStatus::Stopped) => "stopped".into(),
                        Ok(pm_ports::ServiceStatus::Starting) => "starting".into(),
                        Ok(pm_ports::ServiceStatus::Unknown) => "unknown".into(),
                        Err(_) => "unknown".into(),
                    },
                    None => "unknown".into(),
                },
                ServiceKind::Command => self
                    .resolve_command_service_status(service.id(), observed_ports.is_empty())
                    .await,
            };

            service_rows.push(ManagedServiceDto {
                id: service.id(),
                name: service.name().to_owned(),
                kind: match service.kind() {
                    ServiceKind::WindowsService => "windows_service".into(),
                    ServiceKind::Command => "command".into(),
                },
                service_name: service.service_name().map(ToOwned::to_owned),
                workdir: service.workdir().map(ToOwned::to_owned),
                start_command: service.start_command().map(ToOwned::to_owned),
                stop_command: service.stop_command().map(ToOwned::to_owned),
                auto_detected_from: service.auto_detected_from().map(ToOwned::to_owned),
                expected_ports: service.expected_ports().to_vec(),
                observed_ports,
                status,
                is_favorite: favorites
                    .iter()
                    .any(|favorite| favorite.target == FavoriteTarget::Service(service.id())),
            });
        }

        Ok(DashboardSnapshotDto {
            ports: port_rows,
            services: service_rows,
        })
    }

    pub async fn get_port_process_detail(
        &self,
        pid: u32,
        process_name: Option<String>,
    ) -> std::result::Result<ProcessDetailDto, ApplicationError> {
        let detail = self
            .process_controller
            .get_process_details(pid)
            .await
            .map_err(|error| ApplicationError::ProcessControlFailed(error.to_string()))?
            .ok_or(ApplicationError::ProcessMissing(pid))?;

        Ok(ProcessDetailDto {
            pid,
            process_name,
            executable_path: detail.executable_path,
            started_at: detail.started_at,
            working_set_bytes: detail.working_set_bytes,
            private_bytes: detail.private_bytes,
            vendor: detail.vendor,
            file_version: detail.file_version,
            digital_signature: detail.digital_signature,
        })
    }

    pub async fn detect_project_services(
        &self,
        root: &str,
    ) -> std::result::Result<Vec<DetectedServiceCandidateDto>, ApplicationError> {
        if !Path::new(root).exists() {
            return Err(ApplicationError::InvalidProjectPath(root.to_owned()));
        }

        let candidates = self
            .project_detector
            .detect(root)
            .await
            .map_err(|error| ApplicationError::CommandControlFailed(error.to_string()))?;

        Ok(candidates
            .into_iter()
            .map(map_detected_candidate)
            .collect::<Vec<_>>())
    }

    pub async fn kill_process_by_port(
        &self,
        port: u16,
    ) -> std::result::Result<u32, ApplicationError> {
        let record = self
            .port_provider
            .scan_ports()
            .await
            .map_err(|error| ApplicationError::ProcessControlFailed(error.to_string()))?
            .into_iter()
            .find(|record| record.port == port)
            .ok_or(ApplicationError::PortOwnerMissing(port))?;

        let pid = record.pid.ok_or(ApplicationError::PortOwnerMissing(port))?;

        self.process_controller
            .kill_pid(pid)
            .await
            .map_err(|error| ApplicationError::ProcessControlFailed(error.to_string()))?;

        if let Some(service_id) = record.matched_service_id {
            if let Ok(Some(service)) = self.managed_service_repository.get(service_id).await {
                if matches!(service.kind(), ServiceKind::Command) {
                    if let Ok(Some(run)) = self.run_state_repository.get(service_id).await {
                        let stopped = ManagedServiceRun {
                            service_id,
                            status: ServiceRunStatus::Stopped,
                            root_pid: None,
                            child_pids: run.child_pids,
                            started_at: run.started_at,
                            last_exit_code: run.last_exit_code,
                            log_path: run.log_path,
                            ownership: run.ownership,
                        };

                        let _ = self.run_state_repository.save(stopped).await;
                    }
                }
            }
        }

        Ok(pid)
    }

    pub async fn toggle_favorite(&self, target: FavoriteTarget) -> Result<()> {
        let favorites = self.favorite_repository.list().await?;
        if favorites.iter().any(|favorite| favorite.target == target) {
            self.favorite_repository.delete(&target).await
        } else {
            self.favorite_repository.upsert(Favorite::new(target)).await
        }
    }

    pub async fn set_port_favorite(
        &self,
        row_key: String,
        port: u16,
        is_favorite: bool,
    ) -> Result<()> {
        let row_target = FavoriteTarget::PortRow {
            key: row_key,
            port,
        };
        let legacy_target = FavoriteTarget::Port(port);

        if is_favorite {
            self.favorite_repository.delete(&legacy_target).await?;
            self.favorite_repository.upsert(Favorite::new(row_target)).await
        } else {
            self.favorite_repository.delete(&row_target).await?;
            self.favorite_repository.delete(&legacy_target).await
        }
    }

    pub async fn save_managed_service(&self, draft: ManagedServiceDraftDto) -> Result<Uuid> {
        let service = draft.into_service()?;
        let id = service.id();
        self.managed_service_repository.save(service).await?;
        Ok(id)
    }

    pub async fn delete_managed_service(&self, id: Uuid) -> Result<()> {
        self.favorite_repository
            .delete(&FavoriteTarget::Service(id))
            .await?;
        self.managed_service_repository.delete(id).await
    }

    pub async fn start_managed_service(&self, id: Uuid) -> std::result::Result<(), ApplicationError> {
        let service = self
            .managed_service_repository
            .get(id)
            .await
            .map_err(|error| ApplicationError::ServiceControlFailed(error.to_string()))?
            .ok_or_else(|| ApplicationError::ManagedServiceMissing(id.to_string()))?;

        match service.kind() {
            ServiceKind::WindowsService => {
                let service_name = service
                    .service_name()
                    .ok_or_else(|| ApplicationError::ManagedServiceMissingServiceName(id.to_string()))?;
                self.service_controller
                    .start(service_name)
                    .await
                    .map_err(|error| ApplicationError::ServiceControlFailed(error.to_string()))?;
            }
            ServiceKind::Command => {
                let start_command = service
                    .start_command()
                    .ok_or_else(|| ApplicationError::ManagedServiceMissingStartCommand(id.to_string()))?;
                let handle = self
                    .command_runner
                    .start(StartCommandRequest {
                        service_id: id.to_string(),
                        service_name: service.name().to_owned(),
                        command: start_command.to_owned(),
                        workdir: service.workdir().map(ToOwned::to_owned),
                    })
                    .await
                    .map_err(|error| ApplicationError::CommandControlFailed(error.to_string()))?;

                let run = ManagedServiceRun {
                    service_id: id,
                    status: ServiceRunStatus::Starting,
                    root_pid: Some(handle.root_pid),
                    child_pids: handle.child_pids,
                    started_at: Some(Utc::now()),
                    last_exit_code: None,
                    log_path: handle.log_path,
                    ownership: RunOwnership::Managed,
                };

                self.run_state_repository
                    .save(run)
                    .await
                    .map_err(|error| ApplicationError::CommandControlFailed(error.to_string()))?;
            }
        }

        Ok(())
    }

    pub async fn stop_managed_service(&self, id: Uuid) -> std::result::Result<(), ApplicationError> {
        let service = self
            .managed_service_repository
            .get(id)
            .await
            .map_err(|error| ApplicationError::ServiceControlFailed(error.to_string()))?
            .ok_or_else(|| ApplicationError::ManagedServiceMissing(id.to_string()))?;

        match service.kind() {
            ServiceKind::WindowsService => {
                let service_name = service
                    .service_name()
                    .ok_or_else(|| ApplicationError::ManagedServiceMissingServiceName(id.to_string()))?;
                self.service_controller
                    .stop(service_name)
                    .await
                    .map_err(|error| ApplicationError::ServiceControlFailed(error.to_string()))?;
            }
            ServiceKind::Command => {
                let run = self
                    .run_state_repository
                    .get(id)
                    .await
                    .map_err(|error| ApplicationError::CommandControlFailed(error.to_string()))?
                    .ok_or_else(|| ApplicationError::ManagedServiceNotRunning(id.to_string()))?;

                let Some(root_pid) = run.root_pid else {
                    return Err(ApplicationError::ManagedServiceRunPidMissing(id.to_string()));
                };

                let stop_result = self
                    .command_runner
                    .stop(StopCommandRequest {
                        root_pid,
                        child_pids: run.child_pids.clone(),
                        stop_command: service.stop_command().map(ToOwned::to_owned),
                        workdir: service.workdir().map(ToOwned::to_owned),
                    })
                    .await
                    .map_err(|error| ApplicationError::CommandControlFailed(error.to_string()))?;

                let stopped = ManagedServiceRun {
                    service_id: id,
                    status: ServiceRunStatus::Stopped,
                    root_pid: None,
                    child_pids: stop_result.child_pids,
                    started_at: run.started_at,
                    last_exit_code: stop_result.last_exit_code.or(run.last_exit_code),
                    log_path: run.log_path,
                    ownership: run.ownership,
                };

                self.run_state_repository
                    .save(stopped)
                    .await
                    .map_err(|error| ApplicationError::CommandControlFailed(error.to_string()))?;
            }
        }

        Ok(())
    }
}

impl ManagedServiceDraftDto {
    fn into_service(self) -> Result<ManagedService> {
        let kind = self.kind.to_ascii_lowercase();
        match kind.as_str() {
            "windows_service" | "windows-service" | "windows" => {
                let service_name = self.service_name.ok_or_else(|| {
                    ApplicationError::ManagedServiceMissingServiceName(self.name.clone())
                })?;
                Ok(ManagedService::windows_service(self.name, service_name, self.expected_ports))
            }
            "command" => {
                let start_command = self.start_command.ok_or_else(|| {
                    ApplicationError::ManagedServiceMissingStartCommand(self.name.clone())
                })?;
                Ok(ManagedService::command_with_stop(
                    self.name,
                    start_command,
                    self.stop_command,
                    self.workdir,
                    self.expected_ports,
                )
                .with_auto_detected_from(self.auto_detected_from))
            }
            other => Err(ApplicationError::InvalidManagedServiceKind(other.to_owned()).into()),
        }
    }
}

impl<P, PC, SC, CR, PD, FR, MR, RR> PortManagerService<P, PC, SC, CR, PD, FR, MR, RR>
where
    P: PortProvider,
    PC: ProcessController,
    SC: ServiceController,
    CR: CommandRunner,
    PD: ProjectDetector,
    FR: FavoriteRepository,
    MR: ManagedServiceRepository,
    RR: RunStateRepository,
{
    async fn resolve_command_service_status(
        &self,
        service_id: ManagedServiceId,
        observed_ports_empty: bool,
    ) -> String {
        match self.run_state_repository.get(service_id).await {
            Ok(Some(run)) => match run.status {
                ServiceRunStatus::Running | ServiceRunStatus::Starting => {
                    let Some(root_pid) = run.root_pid else {
                        return if run.status == ServiceRunStatus::Starting {
                            "failed".into()
                        } else {
                            "stopped".into()
                        };
                    };

                    match self.process_controller.is_pid_running(root_pid).await {
                        Ok(true) => {
                            if run.status == ServiceRunStatus::Starting {
                                let corrected = ManagedServiceRun {
                                    service_id,
                                    status: ServiceRunStatus::Running,
                                    root_pid: run.root_pid,
                                    child_pids: run.child_pids,
                                    started_at: run.started_at,
                                    last_exit_code: run.last_exit_code,
                                    log_path: run.log_path,
                                    ownership: run.ownership,
                                };
                                let _ = self.run_state_repository.save(corrected).await;
                            }
                            "running".into()
                        }
                        Ok(false) => {
                            let corrected_status = if run.status == ServiceRunStatus::Starting {
                                ServiceRunStatus::Failed
                            } else {
                                ServiceRunStatus::Stopped
                            };
                            let corrected = ManagedServiceRun {
                                service_id,
                                status: corrected_status.clone(),
                                root_pid: None,
                                child_pids: run.child_pids,
                                started_at: run.started_at,
                                last_exit_code: run.last_exit_code,
                                log_path: run.log_path,
                                ownership: run.ownership,
                            };
                            let _ = self.run_state_repository.save(corrected).await;
                            match corrected_status {
                                ServiceRunStatus::Failed => "failed".into(),
                                _ => "stopped".into(),
                            }
                        }
                        Err(_) => "unknown".into(),
                    }
                }
                ServiceRunStatus::Stopped => "stopped".into(),
                ServiceRunStatus::Failed => "failed".into(),
                ServiceRunStatus::Unknown => "unknown".into(),
            },
            Ok(None) => {
                if observed_ports_empty {
                    "stopped".into()
                } else {
                    "running".into()
                }
            }
            Err(_) => "unknown".into(),
        }
    }
}

fn map_detected_candidate(candidate: DetectedServiceCandidate) -> DetectedServiceCandidateDto {
    DetectedServiceCandidateDto {
        name: candidate.name,
        start_command: candidate.start_command,
        workdir: candidate.workdir,
        expected_ports: candidate.expected_ports,
        detected_from: candidate.detected_from,
    }
}
