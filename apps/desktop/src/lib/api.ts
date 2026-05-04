import { invoke } from "@tauri-apps/api/core";
import type { DashboardSnapshotDto, ManagedServiceDraftDto } from "./types";
import {
  deleteManagedService as deleteManagedServiceMock,
  getDashboardSnapshot as getDashboardSnapshotMock,
  isMockRuntime,
  killProcessByPort as killProcessByPortMock,
  saveManagedService as saveManagedServiceMock,
  startManagedService as startManagedServiceMock,
  stopManagedService as stopManagedServiceMock,
  togglePortFavorite as togglePortFavoriteMock,
  toggleServiceFavorite as toggleServiceFavoriteMock,
} from "./mockBackend";
import { isScreenshotMode } from "./screenshotMode";

async function call<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (!isMockRuntime() && !isScreenshotMode()) {
    return invoke<T>(command, args);
  }

  switch (command) {
    case "get_dashboard_snapshot":
      return (await getDashboardSnapshotMock()) as T;
    case "kill_process_by_port":
      return (await killProcessByPortMock(Number(args?.port))) as T;
    case "toggle_port_favorite":
      return (await togglePortFavoriteMock(Number(args?.port))) as T;
    case "toggle_service_favorite":
      return (await toggleServiceFavoriteMock(String(args?.service_id))) as T;
    case "save_managed_service":
      return (await saveManagedServiceMock(args?.draft as ManagedServiceDraftDto)) as T;
    case "delete_managed_service":
      return (await deleteManagedServiceMock(String(args?.service_id))) as T;
    case "start_managed_service":
      return (await startManagedServiceMock(String(args?.service_id))) as T;
    case "stop_managed_service":
      return (await stopManagedServiceMock(String(args?.service_id))) as T;
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

export function getDashboardSnapshot(): Promise<DashboardSnapshotDto> {
  return call<DashboardSnapshotDto>("get_dashboard_snapshot");
}

export function killProcessByPort(port: number): Promise<number> {
  return call<number>("kill_process_by_port", { port });
}

export function togglePortFavorite(port: number): Promise<void> {
  return call<void>("toggle_port_favorite", { port });
}

export function toggleServiceFavorite(service_id: string): Promise<void> {
  return call<void>("toggle_service_favorite", { service_id });
}

export function saveManagedService(draft: ManagedServiceDraftDto): Promise<string> {
  return call<string>("save_managed_service", { draft });
}

export function deleteManagedService(service_id: string): Promise<void> {
  return call<void>("delete_managed_service", { service_id });
}

export function startManagedService(service_id: string): Promise<void> {
  return call<void>("start_managed_service", { service_id });
}

export function stopManagedService(service_id: string): Promise<void> {
  return call<void>("stop_managed_service", { service_id });
}
