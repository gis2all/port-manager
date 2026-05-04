import { invoke } from "@tauri-apps/api/core";
import type {
  DashboardSnapshotDto,
  DetectedServiceCandidateDto,
  ManagedServiceDraftDto,
  ProcessDetailDto,
} from "./types";
import {
  detectProjectServices as detectProjectServicesMock,
  deleteManagedService as deleteManagedServiceMock,
  getDashboardSnapshot as getDashboardSnapshotMock,
  getProcessDetail as getProcessDetailMock,
  isMockRuntime,
  killProcessByPort as killProcessByPortMock,
  saveManagedService as saveManagedServiceMock,
  startManagedService as startManagedServiceMock,
  stopManagedService as stopManagedServiceMock,
  togglePortFavorite as togglePortFavoriteMock,
  toggleServiceFavorite as toggleServiceFavoriteMock,
} from "./mockBackend";

function getArg(args: Record<string, unknown> | undefined, camelKey: string, snakeKey = camelKey): unknown {
  return args?.[camelKey] ?? args?.[snakeKey];
}

async function call<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (!isMockRuntime()) {
    return invoke<T>(command, args);
  }

  switch (command) {
    case "get_dashboard_snapshot":
      return (await getDashboardSnapshotMock()) as T;
    case "kill_process_by_port":
      return (await killProcessByPortMock(Number(args?.port))) as T;
    case "toggle_port_favorite":
      return (await togglePortFavoriteMock(
        String(getArg(args, "rowKey", "row_key")),
        Number(args?.port),
        Boolean(getArg(args, "isFavorite", "is_favorite")),
      )) as T;
    case "toggle_service_favorite":
      return (await toggleServiceFavoriteMock(String(getArg(args, "serviceId", "service_id")))) as T;
    case "save_managed_service":
      return (await saveManagedServiceMock(args?.draft as ManagedServiceDraftDto)) as T;
    case "delete_managed_service":
      return (await deleteManagedServiceMock(String(getArg(args, "serviceId", "service_id")))) as T;
    case "start_managed_service":
      return (await startManagedServiceMock(String(getArg(args, "serviceId", "service_id")))) as T;
    case "stop_managed_service":
      return (await stopManagedServiceMock(String(getArg(args, "serviceId", "service_id")))) as T;
    case "get_process_detail":
      return (await getProcessDetailMock(
        Number(args?.pid),
        typeof getArg(args, "processName", "process_name") === "string"
          ? String(getArg(args, "processName", "process_name"))
          : null,
      )) as T;
    case "detect_project_services":
      return (await detectProjectServicesMock(String(args?.root ?? ""))) as T;
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

export function togglePortFavorite(rowKey: string, port: number, isFavorite: boolean): Promise<void> {
  return call<void>("toggle_port_favorite", { rowKey, port, isFavorite });
}

export function toggleServiceFavorite(serviceId: string): Promise<void> {
  return call<void>("toggle_service_favorite", { serviceId });
}

export function saveManagedService(draft: ManagedServiceDraftDto): Promise<string> {
  return call<string>("save_managed_service", { draft });
}

export function deleteManagedService(serviceId: string): Promise<void> {
  return call<void>("delete_managed_service", { serviceId });
}

export function startManagedService(serviceId: string): Promise<void> {
  return call<void>("start_managed_service", { serviceId });
}

export function stopManagedService(serviceId: string): Promise<void> {
  return call<void>("stop_managed_service", { serviceId });
}

export function getProcessDetail(pid: number, processName: string | null): Promise<ProcessDetailDto> {
  return call<ProcessDetailDto>("get_process_detail", { pid, processName });
}

export function detectProjectServices(root: string): Promise<DetectedServiceCandidateDto[]> {
  return call<DetectedServiceCandidateDto[]>("detect_project_services", { root });
}
