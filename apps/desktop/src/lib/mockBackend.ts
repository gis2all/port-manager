import type {
  DashboardSnapshotDto,
  ManagedServiceDraftDto,
  ManagedServiceDto,
  PortDto,
  PortProtocol,
  PortStatus,
  ServiceKind,
  ServiceStatus,
} from "./types";

type ServiceSeed = ManagedServiceDto;

interface MockState {
  snapshot: DashboardSnapshotDto;
}

const fillerProcessNames: Record<Exclude<PortStatus, "unknown">, string[]> = {
  listening: ["node.exe", "chrome.exe", "python.exe", "docker.exe", "nginx.exe"],
  active: ["svchost.exe", "sqlservr.exe", "java.exe", "dotnet.exe"],
  closed: [],
};

const state: MockState = {
  snapshot: createSeedSnapshot(),
};

function createSeedSnapshot(): DashboardSnapshotDto {
  const apacheService = createService({
    id: "11111111-1111-4111-8111-111111111111",
    name: "apache",
    kind: "command",
    service_name: null,
    workdir: "C:/Apache24",
    start_command: "C:/Apache24/bin/httpd.exe -k runservice",
    expected_ports: [80, 443],
    observed_ports: [80, 443],
    status: "running",
    is_favorite: false,
  });

  const postgresService = createService({
    id: "22222222-2222-4222-8222-222222222222",
    name: "postgres",
    kind: "windows_service",
    service_name: "postgresql-x64-17",
    workdir: "C:/Program Files/PostgreSQL/17",
    start_command: null,
    expected_ports: [5432],
    observed_ports: [5432],
    status: "running",
    is_favorite: false,
  });

  const redisService = createService({
    id: "33333333-3333-4333-8333-333333333333",
    name: "redis",
    kind: "command",
    service_name: null,
    workdir: "C:/Program Files/Redis",
    start_command: "redis-server.exe",
    expected_ports: [6379],
    observed_ports: [6379],
    status: "running",
    is_favorite: false,
  });

  const rdpService = createService({
    id: "44444444-4444-4444-8444-444444444444",
    name: "rdp",
    kind: "windows_service",
    service_name: "TermService",
    workdir: "C:/Windows/System32",
    start_command: null,
    expected_ports: [3389],
    observed_ports: [3389],
    status: "running",
    is_favorite: false,
  });

  const mysqlService = createService({
    id: "55555555-5555-4555-8555-555555555555",
    name: "mysql",
    kind: "command",
    service_name: null,
    workdir: "C:/Program Files/MySQL/MySQL Server 8.0/bin",
    start_command: "mysqld.exe --console",
    expected_ports: [3306],
    observed_ports: [],
    status: "stopped",
    is_favorite: false,
  });

  const backendService = createService({
    id: "66666666-6666-4666-8666-666666666666",
    name: "backend",
    kind: "command",
    service_name: null,
    workdir: "D:/Code/backend",
    start_command: "dotnet MyApp.dll",
    expected_ports: [8080],
    observed_ports: [],
    status: "stopped",
    is_favorite: false,
  });

  return {
    ports: [
      createPort({
        port: 80,
        protocol: "tcp",
        listen_address: "0.0.0.80",
        pid: 4560,
        process_name: "httpd.exe",
        status: "listening",
        is_favorite: true,
        matched_service_id: apacheService.id,
        matched_service_name: apacheService.name,
      }),
      createPort({
        port: 135,
        protocol: "tcp",
        listen_address: "127.0.0.1",
        pid: 928,
        process_name: "svchost.exe (RpcSs)",
        status: "listening",
        is_favorite: false,
        matched_service_id: null,
        matched_service_name: null,
      }),
      createPort({
        port: 443,
        protocol: "tcp",
        listen_address: "0.0.0.443",
        pid: 4560,
        process_name: "httpd.exe",
        status: "listening",
        is_favorite: true,
        matched_service_id: apacheService.id,
        matched_service_name: apacheService.name,
      }),
      createPort({
        port: 5357,
        protocol: "udp",
        listen_address: "0.0.0.5357",
        pid: 2048,
        process_name: "svchost.exe (Dnscache)",
        status: "active",
        is_favorite: false,
        matched_service_id: null,
        matched_service_name: null,
      }),
      createPort({
        port: 3389,
        protocol: "tcp",
        listen_address: "127.0.0.1:3389",
        pid: 1324,
        process_name: "svchost.exe (TermService)",
        status: "listening",
        is_favorite: false,
        matched_service_id: rdpService.id,
        matched_service_name: rdpService.name,
      }),
      createPort({
        port: 5432,
        protocol: "tcp",
        listen_address: "127.0.0.1:5432",
        pid: 3212,
        process_name: "postgres.exe",
        status: "listening",
        is_favorite: true,
        matched_service_id: postgresService.id,
        matched_service_name: postgresService.name,
      }),
      createPort({
        port: 6379,
        protocol: "tcp",
        listen_address: "127.0.0.1:6379",
        pid: 2876,
        process_name: "redis-server.exe",
        status: "listening",
        is_favorite: false,
        matched_service_id: redisService.id,
        matched_service_name: redisService.name,
      }),
      createPort({
        port: 8080,
        protocol: "tcp",
        listen_address: "0.0.0.0",
        pid: null,
        process_name: null,
        status: "closed",
        is_favorite: false,
        matched_service_id: backendService.id,
        matched_service_name: backendService.name,
      }),
      createPort({
        port: 3306,
        protocol: "tcp",
        listen_address: "127.0.0.1:3306",
        pid: null,
        process_name: "mysqld.exe",
        status: "closed",
        is_favorite: false,
        matched_service_id: mysqlService.id,
        matched_service_name: mysqlService.name,
      }),
      ...createFillerPorts(),
    ],
    services: [apacheService, postgresService, redisService, rdpService, mysqlService, backendService],
  };
}

function createFillerPorts(): PortDto[] {
  const statuses: PortStatus[] = [
    ...Array.from({ length: 51 }, () => "listening" as const),
    ...Array.from({ length: 16 }, () => "active" as const),
    ...Array.from({ length: 52 }, () => "closed" as const),
  ];

  return statuses.map((status, index) => {
    const port = 9001 + index;
    const processPool = status === "listening" ? fillerProcessNames.listening : status === "active" ? fillerProcessNames.active : [];
    const processName = status === "closed" ? null : processPool[index % processPool.length];

    return createPort({
      port,
      protocol: index % 5 === 0 ? "udp" : "tcp",
      listen_address: status === "active" ? "0.0.0.0" : "127.0.0.1",
      pid: status === "closed" ? null : 5000 + index,
      process_name: processName,
      status,
      is_favorite: false,
      matched_service_id: null,
      matched_service_name: null,
    });
  });
}

function createPort(input: PortDto): PortDto {
  return { ...input };
}

function createService(input: ManagedServiceDto): ManagedServiceDto {
  return { ...input, observed_ports: [...input.observed_ports], expected_ports: [...input.expected_ports] };
}

function cloneSnapshot(snapshot: DashboardSnapshotDto): DashboardSnapshotDto {
  return JSON.parse(JSON.stringify(snapshot)) as DashboardSnapshotDto;
}

export async function getDashboardSnapshot(): Promise<DashboardSnapshotDto> {
  return cloneSnapshot(state.snapshot);
}

export async function killProcessByPort(port: number): Promise<number> {
  const record = state.snapshot.ports.find((entry) => entry.port === port);
  if (!record || record.pid === null) {
    throw new Error(`port ${port} is not owned by a known process`);
  }

  const pid = record.pid;
  record.pid = null;
  record.process_name = null;
  record.status = "closed";

  const service = record.matched_service_id
    ? state.snapshot.services.find((entry) => entry.id === record.matched_service_id)
    : undefined;
  if (service) {
    service.status = "stopped";
    service.observed_ports = service.observed_ports.filter((value) => value !== record.port);
  }

  return pid;
}

export async function togglePortFavorite(port: number): Promise<void> {
  const record = state.snapshot.ports.find((entry) => entry.port === port);
  if (!record) {
    throw new Error(`port ${port} not found`);
  }

  record.is_favorite = !record.is_favorite;
}

export async function toggleServiceFavorite(serviceId: string): Promise<void> {
  const service = state.snapshot.services.find((entry) => entry.id === serviceId);
  if (!service) {
    throw new Error(`service ${serviceId} not found`);
  }

  service.is_favorite = !service.is_favorite;
}

export async function saveManagedService(draft: ManagedServiceDraftDto): Promise<string> {
  const id = crypto.randomUUID();
  const service = createService({
    id,
    name: draft.name,
    kind: draft.kind,
    service_name: draft.service_name,
    workdir: draft.workdir,
    start_command: draft.start_command,
    expected_ports: [...draft.expected_ports],
    observed_ports: [],
    status: "stopped",
    is_favorite: false,
  });

  state.snapshot.services.push(service);
  return id;
}

export async function deleteManagedService(serviceId: string): Promise<void> {
  state.snapshot.services = state.snapshot.services.filter((entry) => entry.id !== serviceId);
  state.snapshot.ports.forEach((port) => {
    if (port.matched_service_id === serviceId) {
      port.matched_service_id = null;
      port.matched_service_name = null;
    }
  });
}

export async function startManagedService(serviceId: string): Promise<void> {
  const service = state.snapshot.services.find((entry) => entry.id === serviceId);
  if (!service) {
    throw new Error(`service ${serviceId} not found`);
  }

  service.status = "running";
  const portsToMark = service.expected_ports.length > 0 ? service.expected_ports : [];
  for (const portNumber of portsToMark) {
    const existing = state.snapshot.ports.find((entry) => entry.port === portNumber);
    if (existing) {
      existing.status = "listening";
      existing.pid = existing.pid ?? 7000 + (portNumber % 1000);
      existing.process_name = existing.process_name ?? service.name;
      existing.matched_service_id = service.id;
      existing.matched_service_name = service.name;
    } else {
      state.snapshot.ports.push(
        createPort({
          port: portNumber,
          protocol: "tcp",
          listen_address: "127.0.0.1",
          pid: 7000 + (portNumber % 1000),
          process_name: service.name,
          status: "listening",
          is_favorite: false,
          matched_service_id: service.id,
          matched_service_name: service.name,
        }),
      );
    }
  }

  service.observed_ports = [...new Set([...service.observed_ports, ...portsToMark])];
}

export async function stopManagedService(serviceId: string): Promise<void> {
  const service = state.snapshot.services.find((entry) => entry.id === serviceId);
  if (!service) {
    throw new Error(`service ${serviceId} not found`);
  }

  service.status = "stopped";
  for (const portNumber of service.expected_ports) {
    const existing = state.snapshot.ports.find((entry) => entry.port === portNumber);
    if (existing && existing.matched_service_id === service.id) {
      existing.status = "closed";
      existing.pid = null;
      existing.process_name = null;
    }
  }
  service.observed_ports = [];
}

export function isMockRuntime(): boolean {
  return typeof window === "undefined" || !("__TAURI__" in window);
}
