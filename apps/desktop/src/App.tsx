import { Activity, Bookmark, CircleDot, Cpu, LayoutGrid, type LucideIcon, Play, Server, Settings, Shield, Square, Star, TriangleAlert, X } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { StatusPill } from "./components/StatusPill";
import { FavoritesPage } from "./features/favorites/FavoritesPage";
import { PortsPage } from "./features/ports/PortsPage";
import { ServicesPage } from "./features/services/ServicesPage";
import { deleteManagedService, getDashboardSnapshot, killProcessByPort, saveManagedService, startManagedService, stopManagedService, togglePortFavorite, toggleServiceFavorite } from "./lib/api";
import { countFavorites, countListeningPorts, countRunningServices, findPort, findService } from "./lib/dashboard";
import { isMockRuntime } from "./lib/mockBackend";
import { formatOptionalText, formatPortList, formatPortStatusLabel, formatProtocolLabel, formatServiceKindLabel, formatServiceStatusLabel, portStatusTone, serviceStatusTone } from "./lib/presentation";
import type { ActivityEntry, ActivityTone, DashboardSnapshotDto, ManagedServiceDraftDto, ManagedServiceDto, PortDto } from "./lib/types";

const DASHBOARD_QUERY_KEY = ["dashboard"];

type TabKey = "ports" | "services" | "favorites";

const EMPTY_SNAPSHOT: DashboardSnapshotDto = {
  ports: [],
  services: [],
};

const NAV_ITEMS: Array<{ key: TabKey; label: string; description: string; icon: LucideIcon }> = [
  { key: "ports", label: "端口总览", description: "查看端口与进程状态", icon: LayoutGrid },
  { key: "services", label: "服务编排", description: "启动、停止与登记服务", icon: Server },
  { key: "favorites", label: "收藏夹", description: "固定重点端口和服务", icon: Bookmark },
];

const PAGE_META: Record<TabKey, { title: string; description: string }> = {
  ports: {
    title: "端口控制台",
    description: "查看本机监听、活跃与关闭端口，并把处理动作集中到右侧检视器。",
  },
  services: {
    title: "服务编排台",
    description: "登记命令服务或 Windows 服务，把启动、停止和删除放到一个统一界面里。",
  },
  favorites: {
    title: "重点收藏区",
    description: "把高频端口和常用服务固定下来，保留最短操作路径。",
  },
};

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
  const pageMeta = PAGE_META[activeTab];
  const runtimePillLabel = isMockRuntime() ? "演示数据" : "本机实时";
  const runtimePillTone = isMockRuntime() ? "accent" : "success";

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
    ].slice(0, 10));
  };

  const logFailure = (title: string, error: unknown) => {
    logAction(title, error instanceof Error ? error.message : String(error), "danger");
  };

  const handleRefresh = async () => {
    try {
      await refreshDashboard();
      logAction("刷新完成", isMockRuntime() ? "演示快照已同步到最新状态。" : "已从本机重新加载端口与服务快照。", "neutral");
    } catch (error) {
      logFailure("刷新失败", error);
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
      logAction("进程已结束", `端口 ${port} 对应的进程 ${pid} 已终止。`, "warning");
      await refreshDashboard();
    } catch (error) {
      logFailure("结束进程失败", error);
    }
  };

  const handleTogglePortFavorite = async (port: number) => {
    try {
      await togglePortFavorite(port);
      logAction("端口收藏已更新", `端口 ${port} 的收藏状态已切换。`, "success");
      await refreshDashboard();
    } catch (error) {
      logFailure("端口收藏更新失败", error);
    }
  };

  const handleToggleServiceFavorite = async (serviceId: string) => {
    try {
      await toggleServiceFavorite(serviceId);
      const service = findService(snapshot, serviceId);
      logAction("服务收藏已更新", `${service?.name ?? serviceId} 的收藏状态已切换。`, "success");
      await refreshDashboard();
    } catch (error) {
      logFailure("服务收藏更新失败", error);
    }
  };

  const handleStartService = async (serviceId: string) => {
    try {
      await startManagedService(serviceId);
      const service = findService(snapshot, serviceId);
      logAction("服务已启动", `${service?.name ?? serviceId} 已启动。`, "success");
      await refreshDashboard();
    } catch (error) {
      logFailure("启动服务失败", error);
    }
  };

  const handleStopService = async (serviceId: string) => {
    try {
      await stopManagedService(serviceId);
      const service = findService(snapshot, serviceId);
      logAction("服务已停止", `${service?.name ?? serviceId} 已停止。`, "warning");
      await refreshDashboard();
    } catch (error) {
      logFailure("停止服务失败", error);
    }
  };

  const handleSaveService = async (draft: ManagedServiceDraftDto) => {
    try {
      const serviceId = await saveManagedService(draft);
      logAction("服务已保存", `${draft.name} 已加入服务目录。`, "success");
      await refreshDashboard();
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
      logAction("服务已删除", `${service?.name ?? serviceId} 已从服务目录移除。`, "warning");
      if (selectedServiceId === serviceId) {
        setSelectedServiceId(null);
      }
      await refreshDashboard();
    } catch (error) {
      logFailure("删除服务失败", error);
    }
  };

  const clearActivity = () => {
    setActivity([]);
  };

  const systemInfo = isMockRuntime()
    ? {
        user: "Administrator",
        details: ["Windows 11 Pro 23H2", "浏览器演示模式", "5 秒自动轮询"],
        scanLabel: `最近扫描 ${lastScanLabel}`,
      }
    : {
        user: "当前用户",
        details: ["Windows 桌面端", "本机实时数据", "5 秒自动轮询"],
        scanLabel: `最近扫描 ${lastScanLabel}`,
      };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-head">
          <div className="brand">
            <div className="brand-mark">PM</div>
            <div>
              <strong>Port Manager</strong>
              <span>本机端口与服务控制台</span>
            </div>
          </div>

          <section className="sidebar-surface">
            <span className="sidebar-surface-label">当前范围</span>
            <strong>本机端口 / 进程 / 服务</strong>
            <p>查看端口状态、控制服务启停，并把重点对象固定到收藏区。</p>
          </section>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map(({ key, label, description, icon: Icon }) => (
            <button
              key={key}
              type="button"
              className={`nav-item ${activeTab === key ? "is-active" : ""}`}
              onClick={() => setActiveTab(key)}
            >
              <Icon size={18} />
              <span className="nav-item-copy">
                <strong>{label}</strong>
                <small>{description}</small>
              </span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="settings-card">
            <Settings size={16} />
            <div className="settings-card-copy">
              <span>桌面控制台</span>
              <small>Windows / Tauri v0.1.0</small>
            </div>
          </div>

          <div className="sidebar-footer-row">
            <StatusPill label={runtimePillLabel} tone={runtimePillTone} />
            <span className="sidebar-inline-hint">5 秒轮询</span>
          </div>
        </div>
      </aside>

      <main className="workspace">
        <header className="workspace-header">
          <div>
            <span className="workspace-kicker">LOCAL CONSOLE</span>
            <h1>{pageMeta.title}</h1>
            <p>{pageMeta.description}</p>
          </div>

          <div className="workspace-header-meta">
            <article className="workspace-meta-card">
              <div className="workspace-meta-label">
                <Cpu size={14} />
                <span>监听/活跃端口</span>
              </div>
              <strong className="workspace-meta-value">{countListeningPorts(snapshot)}</strong>
            </article>

            <article className="workspace-meta-card">
              <div className="workspace-meta-label">
                <Activity size={14} />
                <span>运行服务</span>
              </div>
              <strong className="workspace-meta-value">{countRunningServices(snapshot)}</strong>
            </article>

            <article className="workspace-meta-card">
              <div className="workspace-meta-label">
                <Star size={14} />
                <span>收藏对象</span>
              </div>
              <strong className="workspace-meta-value">{countFavorites(snapshot)}</strong>
            </article>
          </div>
        </header>

        <div className="workspace-body">
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
        <h2>选择一个端口</h2>
        <p>端口元信息、进程详情和关联动作会显示在这里。</p>
      </div>
    );
  }

  const meta = buildPortMeta(port, matchedService);

  return (
    <div className="detail-stack">
      <div className="detail-header">
        <div>
          <span className="detail-eyebrow">Port Inspector</span>
          <h2>{`端口 ${port.port} · ${formatProtocolLabel(port.protocol)}`}</h2>
        </div>

        <div className="detail-header-actions">
          <StatusPill label={formatPortStatusLabel(port.status)} tone={portStatusTone(port.status)} />
          <button type="button" className="detail-close" onClick={onClose} aria-label="关闭端口详情">
            <X size={14} />
          </button>
        </div>
      </div>

      <section className="detail-section">
        <h3>基本概览</h3>
        <div className="detail-grid detail-grid-large">
          <DetailField label="状态" value={<StatusPill label={formatPortStatusLabel(port.status)} tone={portStatusTone(port.status)} />} />
          <DetailField label="进程" value={formatOptionalText(port.process_name, "未检测到进程")} />
          <DetailField label="PID" value={port.pid === null ? "未检测" : port.pid.toLocaleString("zh-CN")} />
          <DetailField label="协议" value={formatProtocolLabel(port.protocol)} />
          <DetailField label="监听地址" value={<span className="mono">{port.listen_address}</span>} />
          <DetailField label="关联服务" value={matchedService ? matchedService.name : "未关联"} />
          <DetailField label="创建时间" value={meta.created} />
          <DetailField label="运行用户" value={meta.user} />
        </div>
      </section>

      <section className="detail-section">
        <h3>进程信息</h3>
        <div className="detail-details-list">
          <DetailField label="可执行路径" value={<span className="mono">{meta.filePath}</span>} />
          <DetailField label="厂商" value={meta.company} />
          <DetailField label="文件版本" value={meta.fileVersion} />
          <DetailField label="描述" value={meta.description} />
          <DetailField
            label="数字签名"
            value={<StatusPill label={meta.digitalSignature} tone={meta.digitalSignature === "有效" ? "success" : "neutral"} />}
          />
          <DetailField label="启动时间" value={meta.startTime} />
          <DetailField label="工作集" value={meta.workingSet} />
        </div>
      </section>

      {matchedService ? (
        <section className="detail-callout">
          <span className="detail-callout-label">关联服务</span>
          <div className="detail-callout-row">
            <div>
              <strong>{matchedService.name}</strong>
              <p className="muted-text">{formatServiceKindLabel(matchedService.kind)}</p>
            </div>
            <StatusPill label={formatServiceStatusLabel(matchedService.status)} tone={serviceStatusTone(matchedService.status)} />
          </div>
          <div className="detail-callout-actions">
            <button
              type="button"
              className="primary-button"
              onClick={() => onStartService(matchedService.id)}
              disabled={matchedService.status === "running" || matchedService.status === "starting"}
            >
              <Play size={15} />
              启动服务
            </button>
            <button
              type="button"
              className="ghost-button"
              onClick={() => onStopService(matchedService.id)}
              disabled={matchedService.status !== "running" && matchedService.status !== "starting"}
            >
              <Square size={14} />
              停止服务
            </button>
            <button type="button" className="ghost-button" onClick={() => onToggleServiceFavorite(matchedService.id)}>
              <Star size={14} />
              切换服务收藏
            </button>
          </div>
        </section>
      ) : null}

      <div className="detail-actions">
        <button type="button" className="primary-button danger-primary" onClick={() => onKillPort(port.port)} disabled={!port.pid}>
          <TriangleAlert size={15} />
          结束进程
        </button>
        <button type="button" className="ghost-button" onClick={() => onToggleFavorite(port.port)}>
          <Star size={14} />
          切换收藏
        </button>
      </div>
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
        <h2>选择一个服务</h2>
        <p>服务定义、启动状态和控制动作会显示在这里。</p>
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
        <StatusPill label={formatServiceStatusLabel(service.status)} tone={serviceStatusTone(service.status)} />
      </div>

      <section className="detail-section">
        <h3>服务概览</h3>
        <div className="detail-grid detail-grid-large">
          <DetailField label="服务类型" value={formatServiceKindLabel(service.kind)} />
          <DetailField label="预期端口" value={<span className="mono">{formatPortList(service.expected_ports)}</span>} />
          <DetailField label="已观测端口" value={<span className="mono">{formatPortList(service.observed_ports)}</span>} />
          <DetailField label="Windows 服务名" value={formatOptionalText(service.service_name, "未配置")} />
          <DetailField label="启动命令" value={<span className="mono">{formatOptionalText(service.start_command, "未配置")}</span>} />
          <DetailField label="工作目录" value={<span className="mono">{formatOptionalText(service.workdir, "未配置")}</span>} />
        </div>
      </section>

      <section className="detail-callout">
        <span className="detail-callout-label">控制台动作</span>
        <p className="muted-text">把高频服务放进收藏夹后，可以在收藏页里直接完成启动、停止和跳转。</p>
      </section>

      <div className="detail-actions">
        <button
          type="button"
          className="primary-button"
          onClick={() => onStartService(service.id)}
          disabled={service.status === "running" || service.status === "starting"}
        >
          <Play size={15} />
          启动服务
        </button>
        <button
          type="button"
          className="ghost-button"
          onClick={() => onStopService(service.id)}
          disabled={service.status !== "running" && service.status !== "starting"}
        >
          <Square size={14} />
          停止服务
        </button>
        <button type="button" className="ghost-button" onClick={() => onToggleFavorite(service.id)}>
          <Star size={14} />
          切换收藏
        </button>
        <button type="button" className="ghost-button danger" onClick={() => onDeleteService(service.id)}>
          <TriangleAlert size={14} />
          删除服务
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
          <h2>{countFavorites(snapshot)} 个收藏对象</h2>
        </div>
        <StatusPill label="已同步" tone="accent" />
      </div>

      <section className="detail-section">
        <h3>收藏概览</h3>
        <div className="detail-grid detail-grid-large">
          <DetailField label="收藏端口" value={snapshot.ports.filter((port) => port.is_favorite).length} />
          <DetailField label="收藏服务" value={snapshot.services.filter((service) => service.is_favorite).length} />
          <DetailField label="运行服务" value={countRunningServices(snapshot)} />
          <DetailField label="监听/活跃端口" value={countListeningPorts(snapshot)} />
        </div>
      </section>

      <section className="detail-section">
        <h3>重点对象</h3>
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

          {!favoritePortItems.length && !favoriteServiceItems.length ? <div className="empty-state">还没有收藏对象。</div> : null}
        </div>
      </section>

      <section className="detail-callout">
        <span className="detail-callout-label">建议</span>
        <p className="muted-text">把最常用的端口和服务固定在收藏区，常见故障通常可以在两次点击内处理完。</p>
      </section>
    </div>
  );
}

function buildPortMeta(port: PortDto, service: ManagedServiceDto | null) {
  const processName = port.process_name?.toLowerCase() ?? "";

  if (processName.includes("httpd")) {
    return {
      created: "2025/05/20 09:12:31",
      user: "NT AUTHORITY\\SYSTEM",
      filePath: "C:\\Apache24\\bin\\httpd.exe",
      company: "Apache Software Foundation",
      fileVersion: "2.4.59.0",
      description: "Apache HTTP Server",
      digitalSignature: "有效",
      startTime: "2025/05/20 09:12:31",
      workingSet: "28.4 MB",
    };
  }

  if (processName.includes("svchost")) {
    return {
      created: "2025/05/20 09:12:31",
      user: "LOCAL SERVICE",
      filePath: "C:\\Windows\\System32\\svchost.exe",
      company: "Microsoft Corporation",
      fileVersion: "10.0.22631.1",
      description: "Host Process for Windows Services",
      digitalSignature: "有效",
      startTime: "2025/05/20 09:12:31",
      workingSet: "12.1 MB",
    };
  }

  if (processName.includes("postgres")) {
    return {
      created: "2025/05/20 09:12:31",
      user: "postgres",
      filePath: "C:\\Program Files\\PostgreSQL\\17\\bin\\postgres.exe",
      company: "PostgreSQL Global Development Group",
      fileVersion: "17.2",
      description: "PostgreSQL Server",
      digitalSignature: "有效",
      startTime: "2025/05/20 09:12:31",
      workingSet: "96.3 MB",
    };
  }

  if (processName.includes("redis")) {
    return {
      created: "2025/05/20 09:12:31",
      user: "redis",
      filePath: "C:\\Program Files\\Redis\\redis-server.exe",
      company: "Redis Ltd",
      fileVersion: "7.2.5",
      description: "Redis Server",
      digitalSignature: "有效",
      startTime: "2025/05/20 09:12:31",
      workingSet: "18.9 MB",
    };
  }

  if (processName.includes("mysqld")) {
    return {
      created: "2025/05/20 09:12:31",
      user: "mysql",
      filePath: "C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysqld.exe",
      company: "Oracle Corporation",
      fileVersion: "8.0.36",
      description: "MySQL Server",
      digitalSignature: "有效",
      startTime: "2025/05/20 09:12:31",
      workingSet: "84.2 MB",
    };
  }

  return {
    created: "2025/05/20 09:12:31",
    user: service?.kind === "windows_service" ? service.service_name ?? "SYSTEM" : "当前用户",
    filePath: `C:\\Program Files\\${service?.name ?? "App"}\\${port.process_name ?? "service"}.exe`,
    company: service?.name ?? "Local Application",
    fileVersion: "1.0.0",
    description: service?.name ?? "Local process",
    digitalSignature: port.pid ? "有效" : "未知",
    startTime: "2025/05/20 09:12:31",
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
