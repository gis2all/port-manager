import { LogicalSize } from "@tauri-apps/api/dpi";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Bookmark, CircleDot, Copy, LayoutGrid, type LucideIcon, Minus, Network, Play, Server, Settings, Shield, Square, Star, TriangleAlert, X } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { StatusPill } from "./components/StatusPill";
import { FavoritesPage } from "./features/favorites/FavoritesPage";
import { PortsPage } from "./features/ports/PortsPage";
import { ServicesPage } from "./features/services/ServicesPage";
import { deleteManagedService, getDashboardSnapshot, killProcessByPort, saveManagedService, startManagedService, stopManagedService, togglePortFavorite, toggleServiceFavorite } from "./lib/api";
import { countFavorites, countListeningPorts, countRunningServices, findPort, findService } from "./lib/dashboard";
import { isMockRuntime } from "./lib/mockBackend";
import { formatOptionalText, formatPortList, formatPortStatusLabel, formatProtocolLabel, formatServiceKindLabel, formatServiceStatusLabel, portStatusTone, serviceStatusTone } from "./lib/presentation";
import { isScreenshotMode, SCREENSHOT_ACTIVITY, SCREENSHOT_LAST_SCAN_LABEL, SCREENSHOT_SYSTEM_INFO, SCREENSHOT_TIMESTAMP, SCREENSHOT_WINDOW_SIZE } from "./lib/screenshotMode";
import type { ActivityEntry, ActivityTone, DashboardSnapshotDto, ManagedServiceDraftDto, ManagedServiceDto, PortDto } from "./lib/types";

const DASHBOARD_QUERY_KEY = ["dashboard"];

type TabKey = "ports" | "services" | "favorites";

const EMPTY_SNAPSHOT: DashboardSnapshotDto = {
  ports: [],
  services: [],
};

const SCREENSHOT_MODE = isScreenshotMode();

const NAV_ITEMS: Array<{ key: TabKey; label: string; description: string; icon: LucideIcon }> = SCREENSHOT_MODE
  ? [
      { key: "ports", label: "Ports", description: "Monitor ports and process state", icon: LayoutGrid },
      { key: "services", label: "Services", description: "Start, stop, and register services", icon: Server },
      { key: "favorites", label: "Favorites", description: "Pin important ports and services", icon: Bookmark },
    ]
  : [
      { key: "ports", label: "端口总览", description: "查看端口与进程状态", icon: LayoutGrid },
      { key: "services", label: "服务编排", description: "启动、停止与登记服务", icon: Server },
      { key: "favorites", label: "收藏夹", description: "固定重点端口和服务", icon: Bookmark },
    ];

function getDesktopWindowHandle() {
  return isMockRuntime() ? null : getCurrentWindow();
}

export function App() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabKey>("ports");
  const [selectedPort, setSelectedPort] = useState<number | null>(null);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [portSelectionLocked, setPortSelectionLocked] = useState(false);
  const [activity, setActivity] = useState<ActivityEntry[]>(() => (SCREENSHOT_MODE ? SCREENSHOT_ACTIVITY : isMockRuntime() ? createSeedActivity() : []));
  const [lastScanLabel, setLastScanLabel] = useState(() => (SCREENSHOT_MODE ? SCREENSHOT_LAST_SCAN_LABEL : formatClockLabel(new Date())));
  const [isWindowMaximized, setIsWindowMaximized] = useState(false);
  const workspaceBodyRef = useRef<HTMLDivElement | null>(null);

  const dashboard = useQuery({
    queryKey: DASHBOARD_QUERY_KEY,
    queryFn: getDashboardSnapshot,
    refetchInterval: SCREENSHOT_MODE ? false : 5000,
    staleTime: SCREENSHOT_MODE ? Infinity : 2000,
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
    const desktopWindow = getDesktopWindowHandle();
    if (!desktopWindow) {
      return;
    }

    if (!SCREENSHOT_MODE) {
      return;
    }

    const lockWindow = async () => {
      const lockedSize = new LogicalSize(SCREENSHOT_WINDOW_SIZE.width, SCREENSHOT_WINDOW_SIZE.height);

      await desktopWindow.unmaximize();
      await desktopWindow.setResizable(false);
      await desktopWindow.setMinSize(lockedSize);
      await desktopWindow.setMaxSize(lockedSize);
      await desktopWindow.setSize(lockedSize);
      await desktopWindow.center();
      await desktopWindow.show();
      setIsWindowMaximized(false);
    };

    void lockWindow();
  }, []);

  const refreshDashboard = async () => {
    await queryClient.invalidateQueries({ queryKey: DASHBOARD_QUERY_KEY });
    setLastScanLabel(SCREENSHOT_MODE ? SCREENSHOT_LAST_SCAN_LABEL : formatClockLabel(new Date()));
  };

  const logAction = (title: string, detail: string, tone: ActivityTone = "neutral") => {
    setActivity((current) => [
      {
        id: crypto.randomUUID(),
        title,
        detail,
        tone,
        at: SCREENSHOT_MODE ? SCREENSHOT_LAST_SCAN_LABEL : formatClockLabel(new Date()),
      },
      ...current,
    ].slice(0, 10));
  };

  const logFailure = (title: string, error: unknown) => {
    logAction(title, error instanceof Error ? error.message : String(error), "danger");
  };

  const handleRefresh = async () => {
    try {
      await refreshDashboard();
      logAction(
        SCREENSHOT_MODE ? "Refresh complete" : "刷新完成",
        SCREENSHOT_MODE ? "Screenshot snapshot synced to the locked reference state." : isMockRuntime() ? "演示快照已同步到最新状态。" : "已从本机重新加载端口与服务快照。",
        "neutral",
      );
    } catch (error) {
      logFailure(SCREENSHOT_MODE ? "Refresh failed" : "刷新失败", error);
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
      logAction(
        SCREENSHOT_MODE ? "Process terminated" : "进程已结束",
        SCREENSHOT_MODE ? `Process ${pid} on port ${port} was terminated.` : `端口 ${port} 对应的进程 ${pid} 已终止。`,
        "warning",
      );
      await refreshDashboard();
    } catch (error) {
      logFailure(SCREENSHOT_MODE ? "Kill process failed" : "结束进程失败", error);
    }
  };

  const handleTogglePortFavorite = async (port: number) => {
    try {
      await togglePortFavorite(port);
      logAction(
        SCREENSHOT_MODE ? "Favorite updated" : "端口收藏已更新",
        SCREENSHOT_MODE ? `Favorite state for port ${port} was toggled.` : `端口 ${port} 的收藏状态已切换。`,
        "success",
      );
      await refreshDashboard();
    } catch (error) {
      logFailure(SCREENSHOT_MODE ? "Favorite update failed" : "端口收藏更新失败", error);
    }
  };

  const handleToggleServiceFavorite = async (serviceId: string) => {
    try {
      await toggleServiceFavorite(serviceId);
      const service = findService(snapshot, serviceId);
      logAction(
        SCREENSHOT_MODE ? "Service favorite updated" : "服务收藏已更新",
        SCREENSHOT_MODE ? `Favorite state for ${service?.name ?? serviceId} was toggled.` : `${service?.name ?? serviceId} 的收藏状态已切换。`,
        "success",
      );
      await refreshDashboard();
    } catch (error) {
      logFailure(SCREENSHOT_MODE ? "Service favorite update failed" : "服务收藏更新失败", error);
    }
  };

  const handleStartService = async (serviceId: string) => {
    try {
      await startManagedService(serviceId);
      const service = findService(snapshot, serviceId);
      logAction(SCREENSHOT_MODE ? "Service started" : "服务已启动", SCREENSHOT_MODE ? `${service?.name ?? serviceId} started.` : `${service?.name ?? serviceId} 已启动。`, "success");
      await refreshDashboard();
    } catch (error) {
      logFailure(SCREENSHOT_MODE ? "Start service failed" : "启动服务失败", error);
    }
  };

  const handleStopService = async (serviceId: string) => {
    try {
      await stopManagedService(serviceId);
      const service = findService(snapshot, serviceId);
      logAction(SCREENSHOT_MODE ? "Service stopped" : "服务已停止", SCREENSHOT_MODE ? `${service?.name ?? serviceId} stopped.` : `${service?.name ?? serviceId} 已停止。`, "warning");
      await refreshDashboard();
    } catch (error) {
      logFailure(SCREENSHOT_MODE ? "Stop service failed" : "停止服务失败", error);
    }
  };

  const handleSaveService = async (draft: ManagedServiceDraftDto) => {
    try {
      const serviceId = await saveManagedService(draft);
      logAction(SCREENSHOT_MODE ? "Service saved" : "服务已保存", SCREENSHOT_MODE ? `${draft.name} was added to the service catalog.` : `${draft.name} 已加入服务目录。`, "success");
      await refreshDashboard();
      setSelectedServiceId(serviceId);
      setActiveTab("services");
    } catch (error) {
      logFailure(SCREENSHOT_MODE ? "Save service failed" : "保存服务失败", error);
    }
  };

  const handleDeleteService = async (serviceId: string) => {
    try {
      const service = findService(snapshot, serviceId);
      await deleteManagedService(serviceId);
      logAction(
        SCREENSHOT_MODE ? "Service deleted" : "服务已删除",
        SCREENSHOT_MODE ? `${service?.name ?? serviceId} was removed from the service catalog.` : `${service?.name ?? serviceId} 已从服务目录移除。`,
        "warning",
      );
      if (selectedServiceId === serviceId) {
        setSelectedServiceId(null);
      }
      await refreshDashboard();
    } catch (error) {
      logFailure(SCREENSHOT_MODE ? "Delete service failed" : "删除服务失败", error);
    }
  };

  const clearActivity = () => {
    setActivity([]);
  };

  const systemInfo = SCREENSHOT_MODE
    ? SCREENSHOT_SYSTEM_INFO
    : isMockRuntime()
      ? {
          user: "Administrator",
          details: ["Windows 11 Pro 23H2 (22631.3593)", "Intel(R) Core(TM) i7-12700K", "32 GB RAM"],
          scanLabel: "扫描完成",
        }
      : {
          user: "Administrator",
          details: ["Windows 11 Pro 23H2 (22631.3593)", "Intel(R) Core(TM) i7-12700K", "32 GB RAM"],
          scanLabel: "扫描完成",
        };

  return (
    <div className={`app-root ${SCREENSHOT_MODE ? "screenshot-mode" : ""}`}>
      <div className="app-scale-frame">
        <WindowTitlebar isWindowMaximized={isWindowMaximized} />

        <div className="app-shell">
          <aside className="sidebar">
          {!SCREENSHOT_MODE ? (
            <div className="sidebar-head">
              <div className="brand">
                <div className="brand-mark">
                  <Network size={18} />
                </div>
                <div>
                  <strong>Port Manager</strong>
                  <span>Monitor and control local ports and services</span>
                </div>
              </div>
            </div>
          ) : null}

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

          <div className="sidebar-footer">
            <div className="settings-card">
              <Settings size={16} />
              <div className="settings-card-copy">
                <span>{SCREENSHOT_MODE ? "Settings" : "设置"}</span>
              </div>
            </div>

            <div className="sidebar-footer-meta">
              <span>v1.3.0</span>
              <span className="sidebar-footer-status">
                <span className="sidebar-footer-dot" />
                {SCREENSHOT_MODE ? "Up to date" : "已是最新"}
              </span>
            </div>
          </div>
          </aside>

          <main className="workspace">
            <div className="workspace-body" ref={workspaceBodyRef}>
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
              <span className="status-bar-divider">|</span>
            </div>

            <div className="status-bar-center">
              {systemInfo.details.map((item, index) => (
                <span key={item}>
                  {index > 0 ? <span className="status-bar-divider">|</span> : null}
                  {item}
                </span>
              ))}
            </div>

            <div className="status-bar-right">
              <Network size={14} />
              <span className="status-bar-dot" />
              <span>{systemInfo.scanLabel}</span>
            </div>
          </footer>
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
      {SCREENSHOT_MODE ? (
        <div className="window-titlebar-brand">
          <div className="brand">
            <div className="brand-mark">
              <Network size={18} />
            </div>
            <div className="window-titlebar-copy">
              <strong>Port Manager</strong>
              <span>Monitor and control local ports and services</span>
            </div>
          </div>
        </div>
      ) : null}

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
        <h2>{SCREENSHOT_MODE ? "Select a port" : "选择一个端口"}</h2>
        <p>{SCREENSHOT_MODE ? "Port metadata, process details, and related actions appear here." : "端口元信息、进程详情和关联动作会显示在这里。"}</p>
      </div>
    );
  }

  const meta = buildPortMeta(port, matchedService);

  return (
    <div className="detail-stack">
      <div className="detail-header">
        <div>
          <span className="detail-eyebrow">Port Inspector</span>
          <h2>{SCREENSHOT_MODE ? `Port ${port.port} (${formatProtocolLabel(port.protocol)})` : `端口 ${port.port} (${formatProtocolLabel(port.protocol)})`}</h2>
        </div>

        <div className="detail-header-actions">
          <button type="button" className="detail-close" onClick={onClose} aria-label={SCREENSHOT_MODE ? "Close port details" : "关闭端口详情"}>
            <X size={14} />
          </button>
        </div>
      </div>

      <section className="detail-section">
        <h3>{SCREENSHOT_MODE ? "Overview" : "基本概览"}</h3>
        <div className="detail-grid detail-grid-large">
          <DetailField label={SCREENSHOT_MODE ? "Status:" : "状态"} value={<StatusPill label={formatPortStatusLabel(port.status)} tone={portStatusTone(port.status)} />} />
          <DetailField label={SCREENSHOT_MODE ? "Process:" : "进程"} value={formatOptionalText(port.process_name, SCREENSHOT_MODE ? "[No Process]" : "未检测到进程")} />
          <DetailField label="PID:" value={SCREENSHOT_MODE ? (port.pid ?? 0).toLocaleString("en-US") : port.pid === null ? "未检测" : port.pid.toLocaleString("zh-CN")} />
          <DetailField label={SCREENSHOT_MODE ? "Protocol:" : "协议"} value={formatProtocolLabel(port.protocol)} />
          <DetailField label={SCREENSHOT_MODE ? "Listen Address:" : "监听地址"} value={<span className="mono">{port.listen_address}</span>} />
          {SCREENSHOT_MODE ? null : <DetailField label="关联服务" value={matchedService ? matchedService.name : "未关联"} />}
          <DetailField label={SCREENSHOT_MODE ? "Created:" : "创建时间"} value={meta.created} />
          <DetailField label={SCREENSHOT_MODE ? "User:" : "运行用户"} value={meta.user} />
        </div>
      </section>

      <section className="detail-section">
        <h3>{SCREENSHOT_MODE ? "Process Details" : "进程信息"}</h3>
        <div className="detail-details-list">
          <DetailField label={SCREENSHOT_MODE ? "File Path:" : "可执行路径"} value={<span className="mono">{meta.filePath}</span>} />
          <DetailField label={SCREENSHOT_MODE ? "Company:" : "厂商"} value={meta.company} />
          <DetailField label={SCREENSHOT_MODE ? "File Version:" : "文件版本"} value={meta.fileVersion} />
          <DetailField label={SCREENSHOT_MODE ? "Description:" : "描述"} value={meta.description} />
          <DetailField
            label={SCREENSHOT_MODE ? "Digital Signature:" : "数字签名"}
            value={<StatusPill label={meta.digitalSignature} tone={meta.digitalSignature === (SCREENSHOT_MODE ? "Valid" : "有效") ? "success" : "neutral"} />}
          />
          <DetailField label={SCREENSHOT_MODE ? "Start Time:" : "启动时间"} value={meta.startTime} />
          <DetailField label={SCREENSHOT_MODE ? "Working Set:" : "工作集"} value={meta.workingSet} />
        </div>
      </section>

      <section className="detail-section">
        <h3>{SCREENSHOT_MODE ? "Actions" : "操作"}</h3>

      <div className="detail-actions">
        <button type="button" className="primary-button danger-primary" onClick={() => onKillPort(port.port)} disabled={SCREENSHOT_MODE ? false : !port.pid}>
          <TriangleAlert size={15} />
          {SCREENSHOT_MODE ? "Kill Process" : "结束进程"}
        </button>
        {matchedService ? (
          <>
            <button
              type="button"
              className="primary-button"
              onClick={() => onStartService(matchedService.id)}
              disabled={SCREENSHOT_MODE ? false : matchedService.status === "running" || matchedService.status === "starting"}
            >
              <Play size={15} />
              {SCREENSHOT_MODE ? "Start Service" : "启动服务"}
            </button>
            <button
              type="button"
              className="ghost-button"
              onClick={() => onStopService(matchedService.id)}
              disabled={SCREENSHOT_MODE ? false : matchedService.status !== "running" && matchedService.status !== "starting"}
            >
              <Square size={14} />
              {SCREENSHOT_MODE ? "Stop Service" : "停止服务"}
            </button>
          </>
        ) : null}
        <button type="button" className="ghost-button" onClick={() => onToggleFavorite(port.port)}>
          <Star size={14} />
          {SCREENSHOT_MODE ? "Toggle Favorite" : "切换收藏"}
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
        <h2>{SCREENSHOT_MODE ? "Select a service" : "选择一个服务"}</h2>
        <p>{SCREENSHOT_MODE ? "Service definitions, start state, and controls appear here." : "服务定义、启动状态和控制动作会显示在这里。"}</p>
      </div>
    );
  }

  return (
    <div className="detail-stack">
      <div className="detail-header">
        <div>
          <span className="detail-eyebrow">Service Inspector</span>
          <h2>{service.name}</h2>
        </div>
      </div>

      <section className="detail-section">
        <h3>{SCREENSHOT_MODE ? "Overview" : "服务概览"}</h3>
        <div className="detail-grid detail-grid-large">
          <DetailField label={SCREENSHOT_MODE ? "Status:" : "状态"} value={<StatusPill label={formatServiceStatusLabel(service.status)} tone={serviceStatusTone(service.status)} />} />
          <DetailField label={SCREENSHOT_MODE ? "Service Type:" : "服务类型"} value={formatServiceKindLabel(service.kind)} />
          <DetailField label={SCREENSHOT_MODE ? "Expected Ports:" : "预期端口"} value={<span className="mono">{formatPortList(service.expected_ports)}</span>} />
          <DetailField label={SCREENSHOT_MODE ? "Observed Ports:" : "已观测端口"} value={<span className="mono">{formatPortList(service.observed_ports)}</span>} />
          <DetailField label={SCREENSHOT_MODE ? "Windows Service Name:" : "Windows 服务名"} value={formatOptionalText(service.service_name, SCREENSHOT_MODE ? "Not configured" : "未配置")} />
          <DetailField label={SCREENSHOT_MODE ? "Start Command:" : "启动命令"} value={<span className="mono">{formatOptionalText(service.start_command, SCREENSHOT_MODE ? "Not configured" : "未配置")}</span>} />
          <DetailField label={SCREENSHOT_MODE ? "Working Directory:" : "工作目录"} value={<span className="mono">{formatOptionalText(service.workdir, SCREENSHOT_MODE ? "Not configured" : "未配置")}</span>} />
        </div>
      </section>

      <div className="detail-actions">
        <button
          type="button"
          className="primary-button"
          onClick={() => onStartService(service.id)}
          disabled={SCREENSHOT_MODE ? false : service.status === "running" || service.status === "starting"}
        >
          <Play size={15} />
          {SCREENSHOT_MODE ? "Start Service" : "启动服务"}
        </button>
        <button
          type="button"
          className="ghost-button"
          onClick={() => onStopService(service.id)}
          disabled={SCREENSHOT_MODE ? false : service.status !== "running" && service.status !== "starting"}
        >
          <Square size={14} />
          {SCREENSHOT_MODE ? "Stop Service" : "停止服务"}
        </button>
        <button type="button" className="ghost-button" onClick={() => onToggleFavorite(service.id)}>
          <Star size={14} />
          {SCREENSHOT_MODE ? "Toggle Favorite" : "切换收藏"}
        </button>
        <button type="button" className="ghost-button danger" onClick={() => onDeleteService(service.id)}>
          <TriangleAlert size={14} />
          {SCREENSHOT_MODE ? "Delete Service" : "删除服务"}
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
          <span className="detail-eyebrow">Favorites Summary</span>
          <h2>{SCREENSHOT_MODE ? `${countFavorites(snapshot)} favorite items` : `${countFavorites(snapshot)} 个收藏对象`}</h2>
        </div>
      </div>

      <section className="detail-section">
        <h3>{SCREENSHOT_MODE ? "Overview" : "收藏概览"}</h3>
        <div className="detail-grid detail-grid-large">
          <DetailField label={SCREENSHOT_MODE ? "Favorite Ports:" : "收藏端口"} value={snapshot.ports.filter((port) => port.is_favorite).length} />
          <DetailField label={SCREENSHOT_MODE ? "Favorite Services:" : "收藏服务"} value={snapshot.services.filter((service) => service.is_favorite).length} />
          <DetailField label={SCREENSHOT_MODE ? "Running Services:" : "运行服务"} value={countRunningServices(snapshot)} />
          <DetailField label={SCREENSHOT_MODE ? "Listening / Active Ports:" : "监听/活跃端口"} value={countListeningPorts(snapshot)} />
        </div>
      </section>

      <section className="detail-section">
        <h3>{SCREENSHOT_MODE ? "Top Items" : "重点对象"}</h3>
        <div className="detail-note-list">
          {favoritePortItems.map((port) => (
            <div key={`favorite-port-${port.port}`} className="detail-note-item">
              <div>
                <strong>{SCREENSHOT_MODE ? `Port ${port.port}` : `端口 ${port.port}`}</strong>
                <span>{formatOptionalText(port.process_name, SCREENSHOT_MODE ? "Not detected" : "未检测到进程")}</span>
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

          {!favoritePortItems.length && !favoriteServiceItems.length ? <div className="empty-state">{SCREENSHOT_MODE ? "No favorite items yet." : "还没有收藏对象。"}</div> : null}
        </div>
      </section>

    </div>
  );
}

function buildPortMeta(port: PortDto, service: ManagedServiceDto | null) {
  const processName = port.process_name?.toLowerCase() ?? "";
  const createdAt = SCREENSHOT_MODE ? SCREENSHOT_TIMESTAMP : "2025/05/20 09:12:31";
  const signatureLabel = SCREENSHOT_MODE ? "Valid" : "有效";

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
    user: service?.kind === "windows_service" ? service.service_name ?? (SCREENSHOT_MODE ? "SYSTEM" : "SYSTEM" ) : SCREENSHOT_MODE ? "Current User" : "当前用户",
    filePath: `C:\\Program Files\\${service?.name ?? "App"}\\${port.process_name ?? "service"}.exe`,
    company: service?.name ?? "Local Application",
    fileVersion: "1.0.0",
    description: service?.name ?? "Local process",
    digitalSignature: port.pid ? signatureLabel : SCREENSHOT_MODE ? "Unknown" : "未知",
    startTime: createdAt,
    workingSet: "24.0 MB",
  };
}

function createSeedActivity(): ActivityEntry[] {
  return [
    {
      id: "activity-1",
      title: "监听建立",
      detail: "端口 80 (TCP) 正在监听，进程为 httpd.exe。",
      tone: "success",
      at: "10:15:30",
    },
    {
      id: "activity-2",
      title: "连接活跃",
      detail: "端口 5357 (UDP) 进入活跃状态。",
      tone: "accent",
      at: "10:15:28",
    },
    {
      id: "activity-3",
      title: "服务停止",
      detail: "端口 8080 (TCP) 当前未监听。",
      tone: "warning",
      at: "10:15:26",
    },
    {
      id: "activity-4",
      title: "监听建立",
      detail: "端口 443 (TCP) 正在监听，进程为 httpd.exe。",
      tone: "success",
      at: "10:15:24",
    },
    {
      id: "activity-5",
      title: "连接活跃",
      detail: "端口 6379 (TCP) 已建立活动连接。",
      tone: "accent",
      at: "10:15:20",
    },
  ];
}

function formatClockLabel(date: Date) {
  return date.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}
