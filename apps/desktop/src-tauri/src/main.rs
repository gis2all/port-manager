#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use pm_application::{
    DashboardSnapshotDto, DetectedServiceCandidateDto, ManagedServiceDraftDto, ProcessDetailDto,
};
use pm_tauri_api as api;
use pm_tauri_api::AppState;
use tauri::{Manager, State};
use uuid::Uuid;

#[tauri::command]
async fn get_dashboard_snapshot(state: State<'_, AppState>) -> Result<DashboardSnapshotDto, String> {
    api::get_dashboard_snapshot(state).await
}

#[tauri::command]
async fn kill_process_by_port(state: State<'_, AppState>, port: u16) -> Result<u32, String> {
    api::kill_process_by_port(state, port).await
}

#[tauri::command]
async fn toggle_port_favorite(
    state: State<'_, AppState>,
    row_key: String,
    port: u16,
    is_favorite: bool,
) -> Result<(), String> {
    api::toggle_port_favorite(state, row_key, port, is_favorite).await
}

#[tauri::command]
async fn toggle_service_favorite(state: State<'_, AppState>, service_id: Uuid) -> Result<(), String> {
    api::toggle_service_favorite(state, service_id).await
}

#[tauri::command]
async fn save_managed_service(
    state: State<'_, AppState>,
    draft: ManagedServiceDraftDto,
) -> Result<Uuid, String> {
    api::save_managed_service(state, draft).await
}

#[tauri::command]
async fn delete_managed_service(state: State<'_, AppState>, service_id: Uuid) -> Result<(), String> {
    api::delete_managed_service(state, service_id).await
}

#[tauri::command]
async fn start_managed_service(state: State<'_, AppState>, service_id: Uuid) -> Result<(), String> {
    api::start_managed_service(state, service_id).await
}

#[tauri::command]
async fn stop_managed_service(state: State<'_, AppState>, service_id: Uuid) -> Result<(), String> {
    api::stop_managed_service(state, service_id).await
}

#[tauri::command]
async fn get_process_detail(
    state: State<'_, AppState>,
    pid: u32,
    process_name: Option<String>,
) -> Result<ProcessDetailDto, String> {
    api::get_process_detail(state, pid, process_name).await
}

#[tauri::command]
async fn detect_project_services(
    state: State<'_, AppState>,
    root: String,
) -> Result<Vec<DetectedServiceCandidateDto>, String> {
    api::detect_project_services(state, root).await
}

fn main() {
    let app_state = AppState::new().expect("failed to initialize app state");

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(app_state)
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                if let Some(icon) = app.default_window_icon().cloned() {
                    let _ = window.set_icon(icon);
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_dashboard_snapshot,
            kill_process_by_port,
            toggle_port_favorite,
            toggle_service_favorite,
            save_managed_service,
            delete_managed_service,
            start_managed_service,
            stop_managed_service,
            get_process_detail,
            detect_project_services,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
