use crate::state::AppState;
use pm_application::{DashboardSnapshotDto, ManagedServiceDraftDto};
use pm_domain::FavoriteTarget;
use tauri::State;
use uuid::Uuid;

pub async fn get_dashboard_snapshot(state: State<'_, AppState>) -> Result<DashboardSnapshotDto, String> {
    state
        .service()
        .dashboard_snapshot()
        .await
        .map_err(|error| error.to_string())
}

pub async fn kill_process_by_port(state: State<'_, AppState>, port: u16) -> Result<u32, String> {
    state
        .service()
        .kill_process_by_port(port)
        .await
        .map_err(|error| error.to_string())
}

pub async fn toggle_port_favorite(state: State<'_, AppState>, port: u16) -> Result<(), String> {
    state
        .service()
        .toggle_favorite(FavoriteTarget::Port(port))
        .await
        .map_err(|error| error.to_string())
}

pub async fn toggle_service_favorite(state: State<'_, AppState>, service_id: Uuid) -> Result<(), String> {
    state
        .service()
        .toggle_favorite(FavoriteTarget::Service(service_id))
        .await
        .map_err(|error| error.to_string())
}

pub async fn save_managed_service(
    state: State<'_, AppState>,
    draft: ManagedServiceDraftDto,
) -> Result<Uuid, String> {
    state
        .service()
        .save_managed_service(draft)
        .await
        .map_err(|error| error.to_string())
}

pub async fn delete_managed_service(state: State<'_, AppState>, service_id: Uuid) -> Result<(), String> {
    state
        .service()
        .delete_managed_service(service_id)
        .await
        .map_err(|error| error.to_string())
}

pub async fn start_managed_service(state: State<'_, AppState>, service_id: Uuid) -> Result<(), String> {
    state
        .service()
        .start_managed_service(service_id)
        .await
        .map_err(|error| error.to_string())
}

pub async fn stop_managed_service(state: State<'_, AppState>, service_id: Uuid) -> Result<(), String> {
    state
        .service()
        .stop_managed_service(service_id)
        .await
        .map_err(|error| error.to_string())
}
