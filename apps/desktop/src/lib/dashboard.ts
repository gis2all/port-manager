import type { DashboardSnapshotDto, ManagedServiceDto, PortDto } from "./types";

export function countListeningPorts(snapshot: DashboardSnapshotDto): number {
  return snapshot.ports.filter((port) => port.status === "listening" || port.status === "active").length;
}

export function countRunningServices(snapshot: DashboardSnapshotDto): number {
  return snapshot.services.filter((service) => service.status === "running").length;
}

export function countFavorites(snapshot: DashboardSnapshotDto): number {
  return snapshot.ports.filter((port) => port.is_favorite).length + snapshot.services.filter((service) => service.is_favorite).length;
}

export function findPort(snapshot: DashboardSnapshotDto, port: number): PortDto | undefined {
  return snapshot.ports.find((entry) => entry.port === port);
}

export function findService(snapshot: DashboardSnapshotDto, serviceId: string): ManagedServiceDto | undefined {
  return snapshot.services.find((entry) => entry.id === serviceId);
}

export function favoritePorts(snapshot: DashboardSnapshotDto): PortDto[] {
  return snapshot.ports.filter((port) => port.is_favorite);
}

export function favoriteServices(snapshot: DashboardSnapshotDto): ManagedServiceDto[] {
  return snapshot.services.filter((service) => service.is_favorite);
}
