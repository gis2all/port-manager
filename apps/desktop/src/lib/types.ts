export type PortProtocol = "tcp" | "udp";
export type PortStatus = "listening" | "active" | "closed" | "unknown";
export type ServiceKind = "windows_service" | "command";
export type ServiceStatus = "running" | "stopped" | "starting" | "failed" | "unknown";

export interface PortDto {
  port: number;
  protocol: PortProtocol;
  listen_address: string;
  pid: number | null;
  process_name: string | null;
  status: PortStatus;
  is_favorite: boolean;
  matched_service_id: string | null;
  matched_service_name: string | null;
}

export interface ManagedServiceDto {
  id: string;
  name: string;
  kind: ServiceKind;
  service_name: string | null;
  workdir: string | null;
  start_command: string | null;
  expected_ports: number[];
  observed_ports: number[];
  status: ServiceStatus;
  is_favorite: boolean;
}

export interface DashboardSnapshotDto {
  ports: PortDto[];
  services: ManagedServiceDto[];
}

export interface ManagedServiceDraftDto {
  name: string;
  kind: ServiceKind;
  service_name: string | null;
  workdir: string | null;
  start_command: string | null;
  expected_ports: number[];
}

export type ActivityTone = "neutral" | "success" | "warning" | "danger" | "accent";

export interface ActivityEntry {
  id: string;
  title: string;
  detail: string;
  tone: ActivityTone;
  at: string;
}
