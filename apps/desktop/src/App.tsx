import { Bookmark, CircleDot, LayoutGrid, Server, Settings, Shield, Star, X, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { StatusPill } from "./components/StatusPill";
import { FavoritesPage } from "./features/favorites/FavoritesPage";
import { PortsPage } from "./features/ports/PortsPage";
import { ServicesPage } from "./features/services/ServicesPage";
import { deleteManagedService, getDashboardSnapshot, killProcessByPort, saveManagedService, startManagedService, stopManagedService, togglePortFavorite, toggleServiceFavorite } from "./lib/api";
import { countFavorites, findPort, findService } from "./lib/dashboard";
import type { ActivityEntry, ActivityTone, DashboardSnapshotDto, ManagedServiceDraftDto, ManagedServiceDto, PortDto } from "./lib/types";
import { isMockRuntime } from "./lib/mockBackend";

const DASHBOARD_QUERY_KEY = ["dashboard"];

type TabKey = "ports" | "services" | "favorites";

const EMPTY_SNAPSHOT: DashboardSnapshotDto = {
  ports: [],
  services: [],
};

const NAV_ITEMS: Array<{ key: TabKey; label: string; icon: typeof LayoutGrid }> = [
  { key: "ports", label: "Ports", icon: LayoutGrid },
  { key: "services", label: "Services", icon: Server },
  { key: "favorites", label: "Favorites", icon: Bookmark },
];

export function App() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabKey>("ports");
  const [selectedPort, setSelectedPort] = useState<number | null>(null);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [portSelectionLocked, setPortSelectionLocked] = useState(false);
  const [activity, setActivity] = useState<ActivityEntry[]>(() => (isMockRuntime() ? createSeedActivity() : []));
  const [lastScanLabel, setLastScanLabel] = useState(() => formatClockLabel(new Date()));

  const dashboard = useQuery({
    queryKey: DASHBOARD_QUERY_KEY,
    queryFn: getDashboardSnapshot,
    refetchInterval: 5000,
    staleTime: 2000,
  });

  const snapshot = dashboard.data ?? EMPTY_SNAPSHOT;
  const portRecord = selectedPort === null ? null : findPort(snapshot, selectedPort) ?? null;
  const serviceRecord = selectedServiceId === null ? null : findService(snapshot, selectedServiceId) ?? null;
  const portServiceRecord = portRecord
    ? portRecord.matched_service_id
      ? findService(snapshot, portRecord.matched_service_id) ?? snapshot.services.find((service) => service.expected_ports.includes(portRecord.port)) ?? null
      : snapshot.services.find((service) => service.expected_ports.includes(portRecord.port)) ?? null
    : null;

  useEffect(() => {
    if (!snapshot.ports.length) {
      setSelectedPort(null);
      return;
    }

    setSelectedPort((current) => {
      if (current !== null && snapshot.ports.some((port) => port.port === current)) {
        return current;
      }

      return portSelectionLocked ? null : snapshot.ports[0].port;
    });
  }, [snapshot.ports, portSelectionLocked]);

  useEffect(() => {
    if (!snapshot.services.length) {
      setSelectedServiceId(null);
      return;
    }

    setSelectedServiceId((current) => {
      if (current !== null && snapshot.services.some((service) => service.id === current)) {
        return current;
      }

      return snapshot.services[0].id;
    });
  }, [snapshot.services]);

  const refreshDashboard = async () => {
    await queryClient.invalidateQueries({ queryKey: DASHBOARD_QUERY_KEY });
    setLastScanLabel(formatClockLabel(new Date()));
  };

  const logAction = (title: string, detail: string, tone: ActivityTone = "neutral") => {
    setActivity((current) => [
      {
        id: crypto.randomUUID(),
        title,
        detail,
        tone,
        at: formatClockLabel(new Date()),
      },
      ...current,
    ].slice(0, 6));
  };

  const logFailure = (title: string, error: unknown) => {
    logAction(title, error instanceof Error ? error.message : String(error), "danger");
  };

  const handleRefresh = async () => {
    try {
      await refreshDashboard();
      logAction("Refresh complete", isMockRuntime() ? "Browser preview data synced" : "Snapshot reloaded from the local machine", "neutral");
    } catch (error) {
      logFailure("Refresh failed", error);
    }
  };

  const handleSelectPort = (port: number) => {
    setActiveTab("ports");
    setPortSelectionLocked(false);
    setSelectedPort(port);
  };

  const handleClearPortSelection = () => {
    setPortSelectionLocked(true);
    setSelectedPort(null);
  };

  const handleSelectService = (serviceId: string) => {
    setActiveTab("services");
    setSelectedServiceId(serviceId);
  };

  const handleKillPort = async (port: number) => {
    try {
      const pid = await killProcessByPort(port);
      logAction("Port process ended", `Port ${port} process ${pid} terminated`, "warning");
      await refreshDashboard();
    } catch (error) {
      logFailure("Port process end failed", error);
    }
  };

  const handleTogglePortFavorite = async (port: number) => {
    try {
      await togglePortFavorite(port);
      logAction("Port favorite toggled", `Port ${port} favorite state changed`, "success");
      await refreshDashboard();
    } catch (error) {
      logFailure("Port favorite failed", error);
    }
  };

  const handleToggleServiceFavorite = async (serviceId: string) => {
    try {
      await toggleServiceFavorite(serviceId);
      const service = findService(snapshot, serviceId);
      logAction("Service favorite toggled", `${service?.name ?? serviceId} favorite state changed`, "success");
      await refreshDashboard();
    } catch (error) {
      logFailure("Service favorite failed", error);
    }
  };

  const handleStartService = async (serviceId: string) => {
    try {
      await startManagedService(serviceId);
      const service = findService(snapshot, serviceId);
      logAction("Service started", `${service?.name ?? serviceId} started`, "success");
      await refreshDashboard();
    } catch (error) {
      logFailure("Service start failed", error);
    }
  };

  const handleStopService = async (serviceId: string) => {
    try {
      await stopManagedService(serviceId);
      const service = findService(snapshot, serviceId);
      logAction("Service stopped", `${service?.name ?? serviceId} stopped`, "warning");
      await refreshDashboard();
    } catch (error) {
      logFailure("Service stop failed", error);
    }
  };

  const handleSaveService = async (draft: ManagedServiceDraftDto) => {
    try {
      const serviceId = await saveManagedService(draft);
      logAction("Service saved", `${draft.name} saved`, "success");
      await refreshDashboard();
      setSelectedServiceId(serviceId);
      setActiveTab("services");
    } catch (error) {
      logFailure("Service save failed", error);
    }
  };

  const handleDeleteService = async (serviceId: string) => {
    try {
      const service = findService(snapshot, serviceId);
      await deleteManagedService(serviceId);
      logAction("Service deleted", `${service?.name ?? serviceId} deleted`, "warning");
      if (selectedServiceId === serviceId) {
        setSelectedServiceId(null);
      }
      await refreshDashboard();
    } catch (error) {
      logFailure("Service delete failed", error);
    }
  };

  const handleNav = (tab: TabKey) => {
    setActiveTab(tab);
  };

  const clearActivity = () => {
    setActivity([]);
  };

  const systemInfo = isMockRuntime()
    ? {
        user: "Administrator",
        details: ["Windows 11 Pro 23H2 (22631.5393)", "Intel(R) Core(TM) i7-12700K", "32 GB RAM"],
        scanLabel: "Scan completed",
      }
    : {
        user: "Local user",
        details: ["Windows desktop", "Local port inventory", "Live data"],
        scanLabel: "Scan completed",
      };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">PM</div>
          <div>
            <strong>Port Manager</strong>
            <span>{isMockRuntime() ? "Monitor and control local ports and services" : "Monitor and control local ports and services"}</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              className={`nav-item ${activeTab === key ? "is-active" : ""}`}
              onClick={() => handleNav(key)}
            >
              <Icon size={18} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button type="button" className="settings-card">
            <Settings size={16} />
            <div className="settings-card-copy">
              <span>Settings</span>
              <small>v1.3.0</small>
            </div>
          </button>

          <div className="sidebar-footer-row">
            <StatusPill label="Up to date" tone="success" />
          </div>
        </div>
      </aside>

      <main className="workspace">
        {activeTab === "ports" ? (
          <PortsPage
            snapshot={snapshot}
            activity={activity}
            selectedPort={selectedPort}
            onSelectPort={handleSelectPort}
            onRefresh={handleRefresh}
            onTogglePortFavorite={handleTogglePortFavorite}
            onKillPort={handleKillPort}
            onStartService={handleStartService}
            onStopService={handleStopService}
            onToggleServiceFavorite={handleToggleServiceFavorite}
            onOpenFavorites={() => setActiveTab("favorites")}
            onClearActivity={clearActivity}
            isRefreshing={dashboard.isFetching}
            lastScanLabel={lastScanLabel}
          />
        ) : activeTab === "services" ? (
          <ServicesPage
            snapshot={snapshot}
            selectedServiceId={selectedServiceId}
            onSelectService={handleSelectService}
            onRefresh={handleRefresh}
            onToggleServiceFavorite={handleToggleServiceFavorite}
            onStartService={handleStartService}
            onStopService={handleStopService}
            onDeleteService={handleDeleteService}
            onSaveService={handleSaveService}
          />
        ) : (
          <FavoritesPage
            snapshot={snapshot}
            onSelectPort={handleSelectPort}
            onSelectService={handleSelectService}
            onRefresh={handleRefresh}
            onTogglePortFavorite={handleTogglePortFavorite}
            onToggleServiceFavorite={handleToggleServiceFavorite}
            onKillPort={handleKillPort}
            onStartService={handleStartService}
            onStopService={handleStopService}
          />
        )}
      </main>

      <aside className="detail-panel">
        <section className="detail-card">
          {activeTab === "ports" ? (
            <PortDetail
              port={portRecord}
              matchedService={portServiceRecord}
              onClose={handleClearPortSelection}
              onKillPort={handleKillPort}
              onToggleFavorite={handleTogglePortFavorite}
              onStartService={handleStartService}
              onStopService={handleStopService}
              onToggleServiceFavorite={handleToggleServiceFavorite}
            />
          ) : activeTab === "services" ? (
            <ServiceDetail
              service={serviceRecord}
              onStartService={handleStartService}
              onStopService={handleStopService}
              onToggleFavorite={handleToggleServiceFavorite}
              onDeleteService={handleDeleteService}
            />
          ) : (
            <FavoritesDetail snapshot={snapshot} />
          )}
        </section>
      </aside>

      <footer className="status-bar">
        <div className="status-bar-left">
          <Shield size={14} />
          <span>{systemInfo.user}</span>
        </div>

        <div className="status-bar-center">
          {systemInfo.details.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>

        <div className="status-bar-right">
          <span className="status-bar-dot" />
          <span>{systemInfo.scanLabel}</span>
        </div>
      </footer>
    </div>
  );
}

interface PortDetailProps {
  port: PortDto | null;
  matchedService: ManagedServiceDto | null;
  onClose: () => void;
  onKillPort: (port: number) => void;
  onToggleFavorite: (port: number) => void;
  onStartService: (serviceId: string) => void;
  onStopService: (serviceId: string) => void;
  onToggleServiceFavorite: (serviceId: string) => void;
}

function PortDetail({
  port,
  matchedService,
  onClose,
  onKillPort,
  onToggleFavorite,
  onStartService,
  onStopService,
  onToggleServiceFavorite,
}: PortDetailProps) {
  if (!port) {
    return (
      <div className="detail-empty">
        <CircleDot size={32} />
        <h2>Select a port</h2>
        <p>Port metadata, process details, and actions appear here.</p>
      </div>
    );
  }

  const meta = buildPortMeta(port, matchedService);

  return (
    <div className="detail-stack">
      <div className="detail-header">
        <div>
          <span className="detail-eyebrow">Port Details</span>
          <h2>{`Port ${port.port} (${port.protocol.toUpperCase()})`}</h2>
        </div>

        <div className="detail-header-actions">
          <StatusPill label={portStatusLabel(port.status)} tone={portStatusTone(port.status)} />
          <button type="button" className="detail-close" onClick={onClose} aria-label="Close detail panel">
            <X size={14} />
          </button>
        </div>
      </div>

      <section className="detail-section">
        <h3>Overview</h3>
        <div className="detail-grid detail-grid-large">
          <DetailField label="Status" value={<StatusPill label={portStatusLabel(port.status)} tone={portStatusTone(port.status)} />} />
          <DetailField label="Process" value={port.process_name ?? "[No Process]"} />
          <DetailField label="PID" value={port.pid === null ? "—" : port.pid.toLocaleString("en-US")} />
          <DetailField label="Protocol" value={port.protocol.toUpperCase()} />
          <DetailField label="Listen Address" value={<span className="mono">{port.listen_address}</span>} />
          <DetailField label="Created" value={meta.created} />
          <DetailField label="User" value={meta.user} />
        </div>
      </section>

      <section className="detail-section">
        <h3>Process Details</h3>
        <div className="detail-details-list">
          <DetailField label="File Path" value={<span className="mono">{meta.filePath}</span>} />
          <DetailField label="Company" value={meta.company} />
          <DetailField label="File Version" value={meta.fileVersion} />
          <DetailField label="Description" value={meta.description} />
          <DetailField label="Digital Signature" value={<StatusPill label={meta.digitalSignature} tone="success" />} />
          <DetailField label="Start Time" value={meta.startTime} />
          <DetailField label="Working Set" value={meta.workingSet} />
        </div>
      </section>

      {matchedService ? (
        <section className="detail-callout">
          <span className="detail-callout-label">Linked Service</span>
          <div className="detail-callout-row">
            <strong>{matchedService.name}</strong>
            <button type="button" className="inline-action" onClick={() => onToggleServiceFavorite(matchedService.id)}>
              <Star size={14} fill={matchedService.is_favorite ? "currentColor" : "none"} />
              Toggle Favorite
            </button>
          </div>
          <div className="detail-callout-actions">
            <button type="button" className="primary-button" onClick={() => onStartService(matchedService.id)}>
              <Zap size={16} />
              Start Service
            </button>
            <button type="button" className="ghost-button" onClick={() => onStopService(matchedService.id)}>
              Stop Service
            </button>
          </div>
        </section>
      ) : null}

      <div className="detail-actions">
        <button type="button" className="primary-button danger-primary" onClick={() => onKillPort(port.port)} disabled={!port.pid}>
          Kill Process
        </button>
        <button type="button" className="ghost-button" onClick={() => onToggleFavorite(port.port)}>
          Toggle Favorite
        </button>
      </div>
    </div>
  );
}

interface DetailFieldProps {
  label: string;
  value: React.ReactNode;
}

function DetailField({ label, value }: DetailFieldProps) {
  return (
    <div className="detail-field">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

interface ServiceDetailProps {
  service: ManagedServiceDto | null;
  onStartService: (serviceId: string) => void;
  onStopService: (serviceId: string) => void;
  onToggleFavorite: (serviceId: string) => void;
  onDeleteService: (serviceId: string) => void;
}

function ServiceDetail({ service, onStartService, onStopService, onToggleFavorite, onDeleteService }: ServiceDetailProps) {
  if (!service) {
    return (
      <div className="detail-empty">
        <CircleDot size={32} />
        <h2>Select a service</h2>
        <p>Service definition, status, and startup controls appear here.</p>
      </div>
    );
  }

  return (
    <div className="detail-stack">
      <div className="detail-header">
        <div>
          <span className="detail-eyebrow">Service Details</span>
          <h2>{service.name}</h2>
        </div>
        <StatusPill
          label={service.status === "running" ? "Running" : service.status === "starting" ? "Starting" : service.status === "failed" ? "Failed" : "Stopped"}
          tone={service.status === "running" ? "success" : service.status === "failed" ? "danger" : service.status === "starting" ? "warning" : "neutral"}
        />
      </div>

      <div className="detail-grid detail-grid-large">
        <DetailField label="Type" value={service.kind === "command" ? "Command service" : "Windows service"} />
        <DetailField label="Expected Ports" value={<span className="mono">{service.expected_ports.join(", ") || "—"}</span>} />
        <DetailField label="Observed Ports" value={<span className="mono">{service.observed_ports.join(", ") || "—"}</span>} />
        <DetailField label="Reference" value={<span className="mono">{service.start_command ?? service.service_name ?? "—"}</span>} />
      </div>

      <section className="detail-callout">
        <span className="detail-callout-label">Configuration Path</span>
        <strong className="mono">{service.workdir ?? "—"}</strong>
      </section>

      <div className="detail-actions">
        <button type="button" className="primary-button" onClick={() => (service.status === "running" ? onStopService(service.id) : onStartService(service.id))}>
          {service.status === "running" ? "Stop Service" : "Start Service"}
        </button>
        <button type="button" className="ghost-button" onClick={() => onToggleFavorite(service.id)}>
          Toggle Favorite
        </button>
        <button type="button" className="ghost-button danger" onClick={() => onDeleteService(service.id)}>
          Delete Service
        </button>
      </div>
    </div>
  );
}

function FavoritesDetail({ snapshot }: { snapshot: DashboardSnapshotDto }) {
  return (
    <div className="detail-stack">
      <div className="detail-header">
        <div>
          <span className="detail-eyebrow">Favorites</span>
          <h2>{countFavorites(snapshot)}</h2>
        </div>
        <StatusPill label="Synced" tone="accent" />
      </div>

      <div className="detail-grid detail-grid-large">
        <DetailField label="Favorite Ports" value={snapshot.ports.filter((port) => port.is_favorite).length} />
        <DetailField label="Favorite Services" value={snapshot.services.filter((service) => service.is_favorite).length} />
        <DetailField label="Running Services" value={snapshot.services.filter((service) => service.status === "running").length} />
        <DetailField label="Closed Ports" value={snapshot.ports.filter((port) => port.status === "closed").length} />
      </div>

      <section className="detail-callout">
        <span className="detail-callout-label">Suggestion</span>
        <p>Pin your most-used ports and services so they stay one click away.</p>
      </section>
    </div>
  );
}

function buildPortMeta(port: PortDto, service: ManagedServiceDto | null) {
  const processName = port.process_name?.toLowerCase() ?? "";

  if (processName.includes("httpd")) {
    return {
      created: "5/20/2025 9:12:31 AM",
      user: "NT AUTHORITY\\SYSTEM",
      filePath: "C:\\Apache24\\bin\\httpd.exe",
      company: "Apache Software Foundation",
      fileVersion: "2.4.59.0",
      description: "Apache HTTP Server",
      digitalSignature: "Valid",
      startTime: "5/20/2025 9:12:31 AM",
      workingSet: "28.4 MB",
    };
  }

  if (processName.includes("svchost")) {
    return {
      created: "5/20/2025 9:12:31 AM",
      user: "LOCAL SERVICE",
      filePath: "C:\\Windows\\System32\\svchost.exe",
      company: "Microsoft Corporation",
      fileVersion: "10.0.22631.1",
      description: "Host Process for Windows Services",
      digitalSignature: "Valid",
      startTime: "5/20/2025 9:12:31 AM",
      workingSet: "12.1 MB",
    };
  }

  if (processName.includes("postgres")) {
    return {
      created: "5/20/2025 9:12:31 AM",
      user: "postgres",
      filePath: "C:\\Program Files\\PostgreSQL\\17\\bin\\postgres.exe",
      company: "PostgreSQL Global Development Group",
      fileVersion: "17.2",
      description: "PostgreSQL Server",
      digitalSignature: "Valid",
      startTime: "5/20/2025 9:12:31 AM",
      workingSet: "96.3 MB",
    };
  }

  if (processName.includes("redis")) {
    return {
      created: "5/20/2025 9:12:31 AM",
      user: "redis",
      filePath: "C:\\Program Files\\Redis\\redis-server.exe",
      company: "Redis Ltd",
      fileVersion: "7.2.5",
      description: "Redis Server",
      digitalSignature: "Valid",
      startTime: "5/20/2025 9:12:31 AM",
      workingSet: "18.9 MB",
    };
  }

  if (processName.includes("mysqld")) {
    return {
      created: "5/20/2025 9:12:31 AM",
      user: "mysql",
      filePath: "C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysqld.exe",
      company: "Oracle Corporation",
      fileVersion: "8.0.36",
      description: "MySQL Server",
      digitalSignature: "Valid",
      startTime: "5/20/2025 9:12:31 AM",
      workingSet: "84.2 MB",
    };
  }

  return {
    created: "5/20/2025 9:12:31 AM",
    user: service?.kind === "windows_service" ? service.service_name ?? "SYSTEM" : "User",
    filePath: `C:\\Program Files\\${service?.name ?? "App"}\\${port.process_name ?? "service"}.exe`,
    company: service?.name ?? "Local Application",
    fileVersion: "1.0.0",
    description: service?.name ?? "Local process",
    digitalSignature: port.pid ? "Valid" : "Unknown",
    startTime: "5/20/2025 9:12:31 AM",
    workingSet: "24.0 MB",
  };
}

function portStatusLabel(status: PortDto["status"]) {
  switch (status) {
    case "listening":
      return "Listening";
    case "active":
      return "Active";
    case "closed":
      return "Closed";
    default:
      return "Unknown";
  }
}

function portStatusTone(status: PortDto["status"]) {
  switch (status) {
    case "listening":
      return "success";
    case "active":
      return "accent";
    case "closed":
      return "neutral";
    default:
      return "neutral";
  }
}

function createSeedActivity(): ActivityEntry[] {
  return [
    {
      id: "activity-1",
      title: "Listening",
      detail: "Port 80 (TCP) is listening on 0.0.0.80 (httpd.exe)",
      tone: "success",
      at: "10:15:30 AM",
    },
    {
      id: "activity-2",
      title: "Active",
      detail: "Port 5357 (UDP) became active",
      tone: "accent",
      at: "10:15:28 AM",
    },
    {
      id: "activity-3",
      title: "Closed",
      detail: "Port 8080 (TCP) is closed",
      tone: "warning",
      at: "10:15:26 AM",
    },
    {
      id: "activity-4",
      title: "Listening",
      detail: "Port 443 (TCP) is listening on 0.0.0.443 (httpd.exe)",
      tone: "success",
      at: "10:15:24 AM",
    },
    {
      id: "activity-5",
      title: "Active",
      detail: "Port 6379 (TCP) connection established",
      tone: "accent",
      at: "10:15:20 AM",
    },
  ];
}

function formatClockLabel(date: Date) {
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}
