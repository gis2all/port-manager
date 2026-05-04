import { getCurrentWindow } from "@tauri-apps/api/window";
import { Bookmark, CircleDot, Copy, LayoutGrid, type LucideIcon, Minus, Network, Play, Server, Square, Star, TriangleAlert, X } from "lucide-react";
import { type Dispatch, type ReactNode, type SetStateAction, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { StatusPill } from "./components/StatusPill";
import { FavoritesPage } from "./features/favorites/FavoritesPage";
import { PortsPage } from "./features/ports/PortsPage";
import { ServicesPage } from "./features/services/ServicesPage";
import { deleteManagedService, getDashboardSnapshot, killProcessByPort, saveManagedService, startManagedService, stopManagedService, togglePortFavorite, toggleServiceFavorite } from "./lib/api";
import { countFavorites, countListeningPorts, countRunningServices, findPortByRowKey, findService, getPortRowKey } from "./lib/dashboard";
import { isMockRuntime } from "./lib/mockBackend";
import { formatOptionalText, formatPortList, formatPortStatusLabel, formatProtocolLabel, formatServiceKindLabel, formatServiceStatusLabel, portStatusTone, serviceStatusTone } from "./lib/presentation";
import type { ActivityEntry, ActivityTone, DashboardSnapshotDto, ManagedServiceDraftDto, ManagedServiceDto, PortDto } from "./lib/types";

const DASHBOARD_QUERY_KEY = ["dashboard"];

type TabKey = "ports" | "services" | "favorites";

const EMPTY_SNAPSHOT: DashboardSnapshotDto = {
  ports: [],
  services: [],
};

const MAX_ACTIVITY_ENTRIES = 10;

const NAV_ITEMS: Array<{ key: TabKey; label: string; description: string; icon: LucideIcon }> = [
  { key: "ports", label: "端口总览", description: "查看端口与进程状态", icon: LayoutGrid },
  { key: "services", label: "服务编排", description: "启动、停止与登记服务", icon: Server },
  { key: "favorites", label: "收藏夹", description: "固定重点端口和服务", icon: Bookmark },
];

function getDesktopWindowHandle() {
  return isMockRuntime() ? null : getCurrentWindow();
}

export function App() {
  const [activeTab, setActiveTab] = useState<TabKey>("ports");
  const [selectedPortKey, setSelectedPortKey] = useState<string | null>(null);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [portSelectionLocked, setPortSelectionLocked] = useState(false);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [isWindowMaximized, setIsWindowMaximized] = useState(false);
  const workspaceBodyRef = useRef<HTMLDivElement | null>(null);
  const previousSnapshotRef = useRef<DashboardSnapshotDto | null>(null);
  const suppressNextSnapshotDiffRef = useRef(false);

  const dashboard = useQuery({
    queryKey: DASHBOARD_QUERY_KEY,
    queryFn: getDashboardSnapshot,
    refetchInterval: 5000,
    staleTime: 2000,
  });

  const snapshot = dashboard.data ?? EMPTY_SNAPSHOT;
  const lastScanLabel = formatClockLabel(new Date(dashboard.dataUpdatedAt || Date.now()));
  const scanTimestampLabel = formatDetailedTimestamp(new Date(dashboard.dataUpdatedAt || Date.now()));
  const portRecord = selectedPortKey === null ? null : findPortByRowKey(snapshot, selectedPortKey) ?? null;
  const serviceRecord = selectedServiceId === null ? null : findService(snapshot, selectedServiceId) ?? null;
  const portServiceRecord = portRecord
    ? portRecord.matched_service_id
      ? findService(snapshot, portRecord.matched_service_id) ?? snapshot.services.find((service) => service.expected_ports.includes(portRecord.port)) ?? null
      : snapshot.services.find((service) => service.expected_ports.includes(portRecord.port)) ?? null
    : null;

  useEffect(() => {
    if (!snapshot.ports.length) {
      setSelectedPortKey(null);
      return;
    }

    setSelectedPortKey((current) => {
      if (current !== null && snapshot.ports.some((port) => getPortRowKey(port) === current)) {
        return current;
      }

      return portSelectionLocked ? null : getPortRowKey(snapshot.ports[0]);
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

  useEffect(() => {
    workspaceBodyRef.current?.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [activeTab]);

  useEffect(() => {
    const desktopWindow = getDesktopWindowHandle();
    if (!desktopWindow) {
      return;
    }

    let isDisposed = false;
    let unlisten: (() => void) | undefined;

    const syncWindowState = async () => {
      try {
        const maximized = await desktopWindow.isMaximized();
        if (!isDisposed) {
          setIsWindowMaximized(maximized);
        }
      } catch {
        if (!isDisposed) {
          setIsWindowMaximized(false);
        }
      }
    };

    void syncWindowState();
    void desktopWindow.onResized(() => {
      void syncWindowState();
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      isDisposed = true;
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    if (!dashboard.data) {
      return;
    }

    const previousSnapshot = previousSnapshotRef.current;

    if (previousSnapshot && !suppressNextSnapshotDiffRef.current) {
      const diffEntries = buildSnapshotDiffActivity(previousSnapshot, dashboard.data);
      if (diffEntries.length) {
        prependActivityEntries(setActivity, diffEntries, formatClockLabel(new Date(dashboard.dataUpdatedAt || Date.now())));
      }
    }

    suppressNextSnapshotDiffRef.current = false;
    previousSnapshotRef.current = dashboard.data;
  }, [dashboard.data, dashboard.dataUpdatedAt]);

  const refreshDashboard = async ({ suppressSnapshotDiff = false }: { suppressSnapshotDiff?: boolean } = {}) => {
    suppressNextSnapshotDiffRef.current = suppressSnapshotDiff;
    await dashboard.refetch();
  };

  const logAction = (title: string, detail: string, tone: ActivityTone = "neutral") => {
    prependActivityEntries(
      setActivity,
      [{ title, detail, tone }],
      formatClockLabel(new Date()),
    );
  };

  const logFailure = (title: string, error: unknown) => {
    logAction(title, error instanceof Error ? error.message : String(error), "danger");
  };

  const handleRefresh = async () => {
    try {
      await refreshDashboard();
      logAction(
        "刷新完成",
        isMockRuntime() ? "预览快照已同步到最新状态。" : "已从本机重新加载端口与服务快照。",
        "neutral",
      );
    } catch (error) {
      logFailure("刷新失败", error);
    }
  };

  const handleSelectPort = (port: PortDto) => {
    setActiveTab("ports");
    setPortSelectionLocked(false);
    setSelectedPortKey(getPortRowKey(port));
  };

  const handleClearPortSelection = () => {
    setPortSelectionLocked(true);
    setSelectedPortKey(null);
  };

  const handleSelectService = (serviceId: string) => {
    setActiveTab("services");
    setSelectedServiceId(serviceId);
  };

  const handleKillPort = async (port: number) => {
    try {
      const pid = await killProcessByPort(port);
      logAction(
        "进程已结束",
        `端口 ${port} 对应的进程 ${pid} 已终止。`,
        "warning",
      );
      await refreshDashboard({ suppressSnapshotDiff: true });
    } catch (error) {
      logFailure("结束进程失败", error);
    }
  };

  const handleTogglePortFavorite = async (port: PortDto) => {
    const nextFavorite = !port.is_favorite;
    const rowKey = getPortRowKey(port);

    try {
      await togglePortFavorite(rowKey, port.port, nextFavorite);
      logAction(
        "端口收藏已更新",
        `端口 ${port.port} 的收藏状态已切换。`,
        "success",
      );
      await refreshDashboard({ suppressSnapshotDiff: true });
    } catch (error) {
      logFailure("端口收藏更新失败", error);
    }
  };

  const handleToggleServiceFavorite = async (serviceId: string) => {
    try {
      await toggleServiceFavorite(serviceId);
      const service = findService(snapshot, serviceId);
      logAction(
        "服务收藏已更新",
        `${service?.name ?? serviceId} 的收藏状态已切换。`,
        "success",
      );
      await refreshDashboard({ suppressSnapshotDiff: true });
    } catch (error) {
      logFailure("服务收藏更新失败", error);
    }
  };

  const handleStartService = async (serviceId: string) => {
    try {
      await startManagedService(serviceId);
      const service = findService(snapshot, serviceId);
      logAction("服务已启动", `${service?.name ?? serviceId} 已启动。`, "success");
      await refreshDashboard({ suppressSnapshotDiff: true });
    } catch (error) {
      logFailure("启动服务失败", error);
    }
  };

  const handleStopService = async (serviceId: string) => {
    try {
      await stopManagedService(serviceId);
      const service = findService(snapshot, serviceId);
      logAction("服务已停止", `${service?.name ?? serviceId} 已停止。`, "warning");
      await refreshDashboard({ suppressSnapshotDiff: true });
    } catch (error) {
      logFailure("停止服务失败", error);
    }
  };

  const handleSaveService = async (draft: ManagedServiceDraftDto) => {
    try {
      const serviceId = await saveManagedService(draft);
      logAction("服务已保存", `${draft.name} 已加入服务目录。`, "success");
      await refreshDashboard({ suppressSnapshotDiff: true });
      setSelectedServiceId(serviceId);
      setActiveTab("services");
    } catch (error) {
      logFailure("保存服务失败", error);
    }
  };

  const handleDeleteService = async (serviceId: string) => {
    try {
      const service = findService(snapshot, serviceId);
      await deleteManagedService(serviceId);
      logAction(
        "服务已删除",
        `${service?.name ?? serviceId} 已从服务目录移除。`,
        "warning",
      );
      if (selectedServiceId === serviceId) {
        setSelectedServiceId(null);
      }
      await refreshDashboard({ suppressSnapshotDiff: true });
    } catch (error) {
      logFailure("删除服务失败", error);
    }
  };

  const clearActivity = () => {
    setActivity([]);
  };

    return (
      <div className="app-root desktop-layout">
      <div className="app-scale-frame">
        <WindowTitlebar isWindowMaximized={isWindowMaximized} />

        <div className="app-shell">
          <aside className="sidebar">
          <nav className="sidebar-nav">
            {NAV_ITEMS.map(({ key, label, description, icon: Icon }) => (
              <button
                key={key}
                type="button"
                className={`nav-item ${activeTab === key ? "is-active" : ""}`}
                onClick={() => setActiveTab(key)}
                title={description}
              >
                <span className="nav-item-icon" aria-hidden="true">
                  <Icon size={18} />
                </span>
                <span className="nav-item-copy">
                  <strong>{label}</strong>
                </span>
              </button>
            ))}
          </nav>

          </aside>

          <main className="workspace">
            <div className="workspace-body" ref={workspaceBodyRef}>
              {activeTab === "ports" ? (
                <PortsPage
                  snapshot={snapshot}
                  activity={activity}
                  selectedPortKey={selectedPortKey}
                  onSelectPort={handleSelectPort}
                  onRefresh={handleRefresh}
                  onTogglePortFavorite={handleTogglePortFavorite}
                  onKillPort={handleKillPort}
                  onStartService={handleStartService}
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
                  isRefreshing={dashboard.isFetching}
                  lastScanLabel={lastScanLabel}
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
                  isRefreshing={dashboard.isFetching}
                  lastScanLabel={lastScanLabel}
                />
              )}
            </div>
          </main>

          <aside className="detail-panel">
            <section className="detail-card">
              {activeTab === "ports" ? (
                <PortDetail
                  port={portRecord}
                  matchedService={portServiceRecord}
                  scanTimestampLabel={scanTimestampLabel}
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

        </div>
      </div>
    </div>
  );
}

function WindowTitlebar({ isWindowMaximized }: { isWindowMaximized: boolean }) {
  const desktopWindow = getDesktopWindowHandle();

  const handleMinimize = () => {
    if (!desktopWindow) {
      return;
    }

    void desktopWindow.minimize();
  };

  const handleToggleMaximize = () => {
    if (!desktopWindow) {
      return;
    }

    void desktopWindow.toggleMaximize();
  };

  const handleClose = () => {
    if (!desktopWindow) {
      return;
    }

    void desktopWindow.close();
  };

  const handleTitlebarMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!desktopWindow || event.button !== 0) {
      return;
    }

    const target = event.target as HTMLElement | null;
    if (target?.closest("button, a, input, select, textarea")) {
      return;
    }

    if (event.detail === 2) {
      void desktopWindow.toggleMaximize();
      return;
    }

    void desktopWindow.startDragging();
  };

  return (
    <header className="window-titlebar">
      <div className="window-titlebar-brand">
        <div className="brand">
          <div className="brand-mark">
            <Network size={18} />
          </div>
          <div className="window-titlebar-copy">
            <strong>{"端口管理器"}</strong>
          </div>
        </div>
      </div>

      <div className="window-titlebar-drag" onMouseDown={handleTitlebarMouseDown} />

      <div className="window-titlebar-actions">
        <button type="button" className="window-control" onClick={handleMinimize} aria-label="最小化窗口">
          <Minus size={16} />
        </button>
        <button type="button" className="window-control" onClick={handleToggleMaximize} aria-label="切换窗口最大化">
          {isWindowMaximized ? <Copy size={14} /> : <Square size={14} />}
        </button>
        <button type="button" className="window-control window-control-close" onClick={handleClose} aria-label="关闭窗口">
          <X size={16} />
        </button>
      </div>
    </header>
  );
}

interface PortDetailProps {
  port: PortDto | null;
  matchedService: ManagedServiceDto | null;
  scanTimestampLabel: string;
  onClose: () => void;
  onKillPort: (port: number) => void;
  onToggleFavorite: (port: PortDto) => void;
  onStartService: (serviceId: string) => void;
  onStopService: (serviceId: string) => void;
  onToggleServiceFavorite: (serviceId: string) => void;
}

function PortDetail({
  port,
  matchedService,
  scanTimestampLabel,
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
        <h2>{"选择一个端口"}</h2>
      </div>
    );
  }

  const meta = buildPortMeta(port, matchedService, scanTimestampLabel);

  return (
    <div className="detail-stack">
      <div className="detail-header">
        <div>
          <span className="detail-eyebrow">{"端口详情"}</span>
          <h2>{`端口 ${port.port} (${formatProtocolLabel(port.protocol)})`}</h2>
        </div>

        <div className="detail-header-actions">
          <button type="button" className="detail-close" onClick={onClose} aria-label={"关闭端口详情"}>
            <X size={14} />
          </button>
        </div>
      </div>

      <section className="detail-section">
        <h3>{"基本概览"}</h3>
        <div className="detail-grid detail-grid-large">
          <DetailField label={"状态"} value={<StatusPill label={formatPortStatusLabel(port.status)} tone={portStatusTone(port.status)} />} />
          <DetailField label={"进程"} value={formatOptionalText(port.process_name, "未检测到进程")} />
          <DetailField label="PID:" value={port.pid === null ? "未检测" : port.pid.toLocaleString("zh-CN")} />
          <DetailField label={"协议"} value={formatProtocolLabel(port.protocol)} />
          <DetailField label={"监听地址"} value={<span className="mono">{port.listen_address}</span>} />
          <DetailField label={"创建时间"} value={meta.created} />
          <DetailField label={"运行用户"} value={meta.user} />
        </div>
      </section>

      <section className="detail-section">
        <h3>{"进程信息"}</h3>
        <div className="detail-details-list">
          <DetailField label={"可执行路径"} value={<span className="mono">{meta.filePath}</span>} />
          <DetailField label={"厂商"} value={meta.company} />
          <DetailField label={"文件版本"} value={meta.fileVersion} />
          <DetailField label={"描述"} value={meta.description} />
          <DetailField
            label={"数字签名"}
            value={<StatusPill label={meta.digitalSignature} tone={meta.digitalSignature === ("有效") ? "success" : "neutral"} />}
          />
          <DetailField label={"启动时间"} value={meta.startTime} />
          <DetailField label={"工作集"} value={meta.workingSet} />
        </div>
      </section>

      <section className="detail-section">
        <h3>{"操作"}</h3>

      <div className="detail-actions">
        <button type="button" className="primary-button danger-primary" onClick={() => onKillPort(port.port)} disabled={!port.pid}>
          <TriangleAlert size={15} />
          {"结束进程"}
        </button>
        {matchedService ? (
          <>
            <button
              type="button"
              className="primary-button"
              onClick={() => onStartService(matchedService.id)}
              disabled={matchedService.status === "running" || matchedService.status === "starting"}
            >
              <Play size={15} />
              {"启动服务"}
            </button>
            <button
              type="button"
              className="ghost-button"
              onClick={() => onStopService(matchedService.id)}
              disabled={matchedService.status !== "running" && matchedService.status !== "starting"}
            >
              <Square size={14} />
              {"停止服务"}
            </button>
          </>
        ) : null}
        <button type="button" className="ghost-button" onClick={() => onToggleFavorite(port)}>
          <Star size={14} />
          {"切换收藏"}
        </button>
      </div>
      </section>
    </div>
  );
}

interface DetailFieldProps {
  label: string;
  value: ReactNode;
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
        <Server size={32} />
        <h2>{"选择一个服务"}</h2>
      </div>
    );
  }

  return (
    <div className="detail-stack">
      <div className="detail-header">
        <div>
          <span className="detail-eyebrow">{"服务详情"}</span>
          <h2>{service.name}</h2>
        </div>
      </div>

      <section className="detail-section">
        <h3>{"服务概览"}</h3>
        <div className="detail-grid detail-grid-large">
          <DetailField label={"状态"} value={<StatusPill label={formatServiceStatusLabel(service.status)} tone={serviceStatusTone(service.status)} />} />
          <DetailField label={"服务类型"} value={formatServiceKindLabel(service.kind)} />
          <DetailField label={"预期端口"} value={<span className="mono">{formatPortList(service.expected_ports)}</span>} />
          <DetailField label={"已观测端口"} value={<span className="mono">{formatPortList(service.observed_ports)}</span>} />
          <DetailField label={"Windows 服务名"} value={formatOptionalText(service.service_name, "未配置")} />
          <DetailField label={"启动命令"} value={<span className="mono">{formatOptionalText(service.start_command, "未配置")}</span>} />
          <DetailField label={"工作目录"} value={<span className="mono">{formatOptionalText(service.workdir, "未配置")}</span>} />
        </div>
      </section>

      <div className="detail-actions">
        <button
          type="button"
          className="primary-button"
          onClick={() => onStartService(service.id)}
          disabled={service.status === "running" || service.status === "starting"}
        >
          <Play size={15} />
          {"启动服务"}
        </button>
        <button
          type="button"
          className="ghost-button"
          onClick={() => onStopService(service.id)}
          disabled={service.status !== "running" && service.status !== "starting"}
        >
          <Square size={14} />
          {"停止服务"}
        </button>
        <button type="button" className="ghost-button" onClick={() => onToggleFavorite(service.id)}>
          <Star size={14} />
          {"切换收藏"}
        </button>
        <button type="button" className="ghost-button danger" onClick={() => onDeleteService(service.id)}>
          <TriangleAlert size={14} />
          {"删除服务"}
        </button>
      </div>
    </div>
  );
}

function FavoritesDetail({ snapshot }: { snapshot: DashboardSnapshotDto }) {
  const favoritePortItems = snapshot.ports.filter((port) => port.is_favorite).slice(0, 2);
  const favoriteServiceItems = snapshot.services.filter((service) => service.is_favorite).slice(0, 2);

  return (
    <div className="detail-stack">
      <div className="detail-header">
        <div>
          <span className="detail-eyebrow">{"收藏总览"}</span>
          <h2>{`${countFavorites(snapshot)} 个收藏对象`}</h2>
        </div>
      </div>

      <section className="detail-section">
        <h3>{"收藏概览"}</h3>
        <div className="detail-grid detail-grid-large">
          <DetailField label={"收藏端口"} value={snapshot.ports.filter((port) => port.is_favorite).length} />
          <DetailField label={"收藏服务"} value={snapshot.services.filter((service) => service.is_favorite).length} />
          <DetailField label={"运行服务"} value={countRunningServices(snapshot)} />
          <DetailField label={"监听/活跃端口"} value={countListeningPorts(snapshot)} />
        </div>
      </section>

      <section className="detail-section">
        <h3>{"重点对象"}</h3>
        <div className="detail-note-list">
          {favoritePortItems.map((port) => (
            <div key={`favorite-port-${port.port}`} className="detail-note-item">
              <div>
                <strong>{`端口 ${port.port}`}</strong>
                <span>{formatOptionalText(port.process_name, "未检测到进程")}</span>
              </div>
              <StatusPill label={formatPortStatusLabel(port.status)} tone={portStatusTone(port.status)} />
            </div>
          ))}

          {favoriteServiceItems.map((service) => (
            <div key={`favorite-service-${service.id}`} className="detail-note-item">
              <div>
                <strong>{service.name}</strong>
                <span>{formatServiceKindLabel(service.kind)}</span>
              </div>
              <StatusPill label={formatServiceStatusLabel(service.status)} tone={serviceStatusTone(service.status)} />
            </div>
          ))}

          {!favoritePortItems.length && !favoriteServiceItems.length ? <div className="empty-state">{"还没有收藏对象。"}</div> : null}
        </div>
      </section>

    </div>
  );
}

function buildPortMeta(port: PortDto, service: ManagedServiceDto | null, scanTimestampLabel: string) {
  const processName = port.process_name?.toLowerCase() ?? "";
  const createdAt = scanTimestampLabel;
  const signatureLabel = "有效";

  if (processName.includes("httpd")) {
    return {
      created: createdAt,
      user: "NT AUTHORITY\\SYSTEM",
      filePath: "C:\\Apache24\\bin\\httpd.exe",
      company: "Apache Software Foundation",
      fileVersion: "2.4.59.0",
      description: "Apache HTTP Server",
      digitalSignature: signatureLabel,
      startTime: createdAt,
      workingSet: "28.4 MB",
    };
  }

  if (processName.includes("svchost")) {
    return {
      created: createdAt,
      user: "LOCAL SERVICE",
      filePath: "C:\\Windows\\System32\\svchost.exe",
      company: "Microsoft Corporation",
      fileVersion: "10.0.22631.1",
      description: "Host Process for Windows Services",
      digitalSignature: signatureLabel,
      startTime: createdAt,
      workingSet: "12.1 MB",
    };
  }

  if (processName.includes("postgres")) {
    return {
      created: createdAt,
      user: "postgres",
      filePath: "C:\\Program Files\\PostgreSQL\\17\\bin\\postgres.exe",
      company: "PostgreSQL Global Development Group",
      fileVersion: "17.2",
      description: "PostgreSQL Server",
      digitalSignature: signatureLabel,
      startTime: createdAt,
      workingSet: "96.3 MB",
    };
  }

  if (processName.includes("redis")) {
    return {
      created: createdAt,
      user: "redis",
      filePath: "C:\\Program Files\\Redis\\redis-server.exe",
      company: "Redis Ltd",
      fileVersion: "7.2.5",
      description: "Redis Server",
      digitalSignature: signatureLabel,
      startTime: createdAt,
      workingSet: "18.9 MB",
    };
  }

  if (processName.includes("mysqld")) {
    return {
      created: createdAt,
      user: "mysql",
      filePath: "C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysqld.exe",
      company: "Oracle Corporation",
      fileVersion: "8.0.36",
      description: "MySQL Server",
      digitalSignature: signatureLabel,
      startTime: createdAt,
      workingSet: "84.2 MB",
    };
  }

  return {
    created: createdAt,
    user: service?.kind === "windows_service" ? service.service_name ?? ("系统") : "当前用户",
    filePath: `C:\\Program Files\\${service?.name ?? "App"}\\${port.process_name ?? "service"}.exe`,
    company: service?.name ?? ("本地应用"),
    fileVersion: "1.0.0",
    description: service?.name ?? ("本地进程"),
    digitalSignature: port.pid ? signatureLabel : "未知",
    startTime: createdAt,
    workingSet: "24.0 MB",
  };
}

function formatClockLabel(date: Date) {
  return date.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function formatDetailedTimestamp(date: Date) {
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

type ActivitySeed = Omit<ActivityEntry, "id" | "at">;

function prependActivityEntries(
  setActivity: Dispatch<SetStateAction<ActivityEntry[]>>,
  entries: ActivitySeed[],
  timestampLabel: string,
) {
  if (!entries.length) {
    return;
  }

  setActivity((current) => [
    ...entries.map((entry) => ({
      ...entry,
      id: crypto.randomUUID(),
      at: timestampLabel,
    })),
    ...current,
  ].slice(0, MAX_ACTIVITY_ENTRIES));
}

function buildSnapshotDiffActivity(previous: DashboardSnapshotDto, next: DashboardSnapshotDto): ActivitySeed[] {
  const entries: ActivitySeed[] = [];

  const previousPorts = new Map(previous.ports.map((port) => [getPortKey(port), port]));
  const nextPorts = new Map(next.ports.map((port) => [getPortKey(port), port]));
  const previousServices = new Map(previous.services.map((service) => [service.id, service]));
  const nextServices = new Map(next.services.map((service) => [service.id, service]));

  for (const [key, port] of nextPorts) {
    const before = previousPorts.get(key);

    if (!before) {
      entries.push({
        title: "端口新增",
        detail: `端口 ${port.port} 已出现在最新快照中。`,
        tone: portStatusTone(port.status),
      });
      continue;
    }

    if (before.status !== port.status) {
      entries.push({
        title: "端口状态变更",
        detail: `端口 ${port.port} 由 ${formatPortStatusLabel(before.status)} 变为 ${formatPortStatusLabel(port.status)}。`,
        tone: portStatusTone(port.status),
      });
    }

    if (before.is_favorite !== port.is_favorite) {
      entries.push({
        title: "端口收藏变更",
        detail: `端口 ${port.port} 已${port.is_favorite ? "加入" : "移出"}收藏。`,
        tone: "accent",
      });
    }
  }

  for (const [key, port] of previousPorts) {
    if (!nextPorts.has(key)) {
      entries.push({
        title: "端口移除",
        detail: `端口 ${port.port} 已从最新快照中移除。`,
        tone: "warning",
      });
    }
  }

  for (const [serviceId, service] of nextServices) {
    const before = previousServices.get(serviceId);

    if (!before) {
      entries.push({
        title: "服务新增",
        detail: `服务 ${service.name} 已进入最新快照。`,
        tone: serviceStatusTone(service.status),
      });
      continue;
    }

    if (before.status !== service.status) {
      entries.push({
        title: "服务状态变更",
        detail: `服务 ${service.name} 由 ${formatServiceStatusLabel(before.status)} 变为 ${formatServiceStatusLabel(service.status)}。`,
        tone: serviceStatusTone(service.status),
      });
    }

    if (before.is_favorite !== service.is_favorite) {
      entries.push({
        title: "服务收藏变更",
        detail: `服务 ${service.name} 已${service.is_favorite ? "加入" : "移出"}收藏。`,
        tone: "accent",
      });
    }
  }

  for (const [serviceId, service] of previousServices) {
    if (!nextServices.has(serviceId)) {
      entries.push({
        title: "服务移除",
        detail: `服务 ${service.name} 已从最新快照中移除。`,
        tone: "warning",
      });
    }
  }

  return entries.slice(0, 6);
}

function getPortKey(port: PortDto) {
  return `${port.protocol}:${port.port}:${port.listen_address}`;
}
