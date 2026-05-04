import { Activity, ChevronDown, ChevronLeft, ChevronRight, CircleDot, Database, ExternalLink, FileText, Globe, Lock, Monitor, MoreHorizontal, Network, Play, RefreshCcw, Settings, Shield, Square, Star, Trash2, type LucideIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { StatusPill } from "../../components/StatusPill";
import { favoritePorts, findService } from "../../lib/dashboard";
import { formatOptionalText, formatPortStatusLabel, formatProtocolLabel, portStatusTone } from "../../lib/presentation";
import { isScreenshotMode, SCREENSHOT_AUTO_REFRESH_LABEL } from "../../lib/screenshotMode";
import type { ActivityEntry, ActivityTone, DashboardSnapshotDto } from "../../lib/types";

const SCREENSHOT_MODE = isScreenshotMode();

interface PortsPageProps {
  snapshot: DashboardSnapshotDto;
  activity: ActivityEntry[];
  selectedPort: number | null;
  onSelectPort: (port: number) => void;
  onRefresh: () => void;
  onTogglePortFavorite: (port: number) => void;
  onKillPort: (port: number) => void;
  onStartService: (serviceId: string) => void;
  onOpenFavorites: () => void;
  onClearActivity: () => void;
  isRefreshing: boolean;
  lastScanLabel: string;
}

const PAGE_SIZE = 9;
const ACTIVITY_FILTERS: Array<{ label: string; value: "all" | ActivityTone }> = SCREENSHOT_MODE
  ? [
      { label: "All Events", value: "all" },
      { label: "Success", value: "success" },
      { label: "Warning", value: "warning" },
      { label: "Error", value: "danger" },
      { label: "Neutral", value: "neutral" },
      { label: "Active", value: "accent" },
    ]
  : [
      { label: "全部事件", value: "all" },
      { label: "成功", value: "success" },
      { label: "提醒", value: "warning" },
      { label: "异常", value: "danger" },
      { label: "普通", value: "neutral" },
      { label: "活跃", value: "accent" },
    ];

const SUMMARY_COPY = SCREENSHOT_MODE
  ? [
      { key: "total", label: "Total Ports", caption: "All scanned", toneClass: "metric-card-accent", icon: Network },
      { key: "listening", label: "Listening", caption: "Active & listening", toneClass: "metric-card-success", icon: CircleDot },
      { key: "active", label: "Active", caption: "Established connections", toneClass: "metric-card-accent", icon: Activity },
      { key: "closed", label: "Closed", caption: "Not listening", toneClass: "metric-card-warning", icon: Shield },
    ]
  : [
      { key: "total", label: "端口总数", caption: "已扫描端口", toneClass: "metric-card-accent", icon: Network },
      { key: "listening", label: "监听中", caption: "活跃与监听", toneClass: "metric-card-success", icon: CircleDot },
      { key: "active", label: "活跃连接", caption: "已建立连接", toneClass: "metric-card-accent", icon: Activity },
      { key: "closed", label: "已关闭", caption: "未在监听", toneClass: "metric-card-danger", icon: Shield },
    ];

interface SummaryMetricCard {
  key: string;
  label: string;
  value: number;
  caption: string;
  icon: LucideIcon;
  toneClass: string;
}

export function PortsPage({
  snapshot,
  activity,
  selectedPort,
  onSelectPort,
  onRefresh,
  onTogglePortFavorite,
  onKillPort,
  onStartService,
  onOpenFavorites,
  onClearActivity,
  isRefreshing,
  lastScanLabel,
}: PortsPageProps) {
  const [page, setPage] = useState(1);
  const [activityFilter, setActivityFilter] = useState<"all" | ActivityTone>("all");

  const serviceById = useMemo(() => new Map(snapshot.services.map((service) => [service.id, service])), [snapshot.services]);
  const totalPorts = snapshot.ports.length;
  const listeningPorts = snapshot.ports.filter((port) => port.status === "listening").length;
  const activePorts = snapshot.ports.filter((port) => port.status === "active").length;
  const closedPorts = snapshot.ports.filter((port) => port.status === "closed").length;
  const totalPages = Math.max(1, Math.ceil(totalPorts / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const pagePorts = snapshot.ports.slice(startIndex, startIndex + PAGE_SIZE);
  const favoritePortRows = favoritePorts(snapshot).slice(0, 3);
  const filteredActivity = activityFilter === "all" ? activity : activity.filter((entry) => entry.tone === activityFilter);
  const visibleActivity = filteredActivity.slice(0, 5);
  const summaryCards: SummaryMetricCard[] = SUMMARY_COPY.map((card) => ({
    ...card,
    value: card.key === "total" ? totalPorts : card.key === "listening" ? listeningPorts : card.key === "active" ? activePorts : closedPorts,
  }));

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  return (
    <div className="console-page">
      <section className="summary-strip">
        {summaryCards.map(({ key, label, value, caption, icon: Icon, toneClass }) => (
          <article key={key} className={`metric-card ${toneClass}`}>
            <div className="metric-card-head">
              <span className="metric-card-symbol" aria-hidden="true">
                <Icon size={16} />
              </span>
              <div className="metric-card-copy">
                <div className="metric-card-label">{label}</div>
                <div className="metric-card-value">{value}</div>
              </div>
            </div>
            <div className="metric-card-caption">{caption}</div>
          </article>
        ))}

        <article className="scan-card">
          <button type="button" className="scan-refresh" onClick={onRefresh} disabled={isRefreshing}>
            <RefreshCcw size={15} />
            <span>{SCREENSHOT_MODE ? (isRefreshing ? "Refreshing..." : "Refresh") : isRefreshing ? "刷新中" : "立即刷新"}</span>
          </button>
          <div className={`metric-card-meta ${SCREENSHOT_MODE ? "scan-card-meta" : ""}`}>
            <span>{SCREENSHOT_MODE ? `Last scan: ${lastScanLabel}` : `最近扫描 ${lastScanLabel}`}</span>
            <span className="scan-card-meta-row">
              {SCREENSHOT_MODE ? <Settings size={12} /> : null}
              <span>{SCREENSHOT_MODE ? `Auto-refresh: ${SCREENSHOT_AUTO_REFRESH_LABEL}` : "自动轮询 5 秒"}</span>
            </span>
          </div>
        </article>
      </section>

      <section className="panel panel-table">
        <div className="table-shell">
          <table className="data-table">
            <colgroup>
              <col className="table-col-port" />
              <col className="table-col-protocol" />
              <col className="table-col-pid" />
              <col className="table-col-process" />
              <col className="table-col-address" />
              <col className="table-col-status" />
              <col className="table-col-favorite" />
              <col className="table-col-actions" />
            </colgroup>
            <thead>
              <tr>
                <th>
                  <span className="table-header-label">
                    <span>{SCREENSHOT_MODE ? "Port" : "端口"}</span>
                    <ChevronDown size={10} className="table-sort-icon" />
                  </span>
                </th>
                <th>{SCREENSHOT_MODE ? "Protocol" : "协议"}</th>
                <th>PID</th>
                <th>{SCREENSHOT_MODE ? "Process" : "进程 / 服务"}</th>
                <th>
                  <span className="table-header-label">
                    <span>{SCREENSHOT_MODE ? "Listen Address" : "监听地址"}</span>
                    <ChevronDown size={10} className="table-sort-icon" />
                  </span>
                </th>
                <th>{SCREENSHOT_MODE ? "Status" : "状态"}</th>
                <th>{SCREENSHOT_MODE ? "Favorite" : "收藏"}</th>
                <th>{SCREENSHOT_MODE ? "Actions" : "动作"}</th>
              </tr>
            </thead>
            <tbody>
              {pagePorts.map((port) => {
                const service = port.matched_service_id ? serviceById.get(port.matched_service_id) ?? findService(snapshot, port.matched_service_id) ?? null : null;
                const isSelected = selectedPort === port.port;
                const canStartService = Boolean(service && port.status === "closed" && service.status !== "running" && service.status !== "starting");
                const processGlyph = getProcessGlyph(port, service);
                const ProcessIcon = processGlyph.icon;
                const pidLabel = SCREENSHOT_MODE
                  ? (port.pid ?? 0).toLocaleString("en-US")
                  : port.pid === null
                    ? "未检"
                    : port.pid.toLocaleString("zh-CN");

                return (
                  <tr key={`${port.port}-${port.listen_address}`} className={isSelected ? "is-selected" : undefined} onClick={() => onSelectPort(port.port)}>
                    <td>
                      <div className="port-cell">
                        <span className="port-number">{port.port}</span>
                      </div>
                    </td>
                    <td>
                      <span className={SCREENSHOT_MODE ? "protocol-label" : "protocol-chip"}>{formatProtocolLabel(port.protocol)}</span>
                    </td>
                    <td className="mono">{pidLabel}</td>
                    <td>
                      <div className="process-cell">
                        <div className={`process-icon ${processGlyph.toneClass}`} aria-hidden="true">
                          <ProcessIcon size={12} strokeWidth={2.1} />
                        </div>
                        <div className="cell-stack">
                          <span className="process-name">{formatOptionalText(port.process_name, SCREENSHOT_MODE ? "[No Process]" : "未检测到进程")}</span>
                          {SCREENSHOT_MODE ? null : <span className="process-service">{service?.name ?? "未关联服务"}</span>}
                        </div>
                      </div>
                    </td>
                    <td className="mono">{port.listen_address}</td>
                    <td>
                      <StatusPill label={formatPortStatusLabel(port.status)} tone={portStatusTone(port.status)} />
                    </td>
                    <td>
                      <button
                        type="button"
                        className={`table-favorite-button ${port.is_favorite ? "is-active" : ""}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          onTogglePortFavorite(port.port);
                        }}
                        aria-label={SCREENSHOT_MODE ? "Toggle port favorite" : "切换端口收藏"}
                      >
                        <Star size={14} fill={port.is_favorite ? "currentColor" : "none"} />
                      </button>
                    </td>
                    <td>
                      <div className="row-actions">
                        {canStartService && service ? (
                          <button
                            type="button"
                            className="table-action-button table-action-button-primary"
                            onClick={(event) => {
                              event.stopPropagation();
                              onStartService(service.id);
                            }}
                            aria-label={SCREENSHOT_MODE ? "Start related service" : "启动关联服务"}
                          >
                            <Play size={13} />
                          </button>
                        ) : null}

                        <button
                          type="button"
                          className="table-action-button table-action-button-more"
                          onClick={(event) => {
                            event.stopPropagation();
                            onSelectPort(port.port);
                          }}
                          aria-label={SCREENSHOT_MODE ? "More actions" : "更多操作"}
                        >
                          <MoreHorizontal size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="table-footer">
          <div className="table-footer-caption">
            {SCREENSHOT_MODE
              ? `Showing ${totalPorts ? startIndex + 1 : 0} to ${Math.min(startIndex + PAGE_SIZE, totalPorts)} of ${totalPorts} ports`
              : `显示 ${totalPorts ? startIndex + 1 : 0} - ${Math.min(startIndex + PAGE_SIZE, totalPorts)} / ${totalPorts} 条端口记录`}
          </div>

          <div className="pagination">
            <button type="button" className="pagination-button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={currentPage === 1}>
              <ChevronLeft size={14} />
            </button>
            {buildPageTokens(totalPages, currentPage).map((token, index) =>
              token === "..." ? (
                <span key={`ellipsis-${index}`} className="pagination-ellipsis">
                  ...
                </span>
              ) : (
                <button
                  type="button"
                  key={token}
                  className={`pagination-page ${token === currentPage ? "is-active" : ""}`}
                  onClick={() => setPage(token)}
                >
                  {token}
                </button>
              ),
            )}
            <button type="button" className="pagination-button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={currentPage === totalPages}>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </section>

      <section className="bottom-grid">
        <article className="panel">
          <header className="panel-header panel-header-tight">
            <div>
              <h2 className="panel-title-with-icon">
                <Star size={14} />
                <span>{SCREENSHOT_MODE ? `Favorites (${favoritePortRows.length})` : `重点端口 (${favoritePortRows.length})`}</span>
              </h2>
            </div>
            {SCREENSHOT_MODE ? null : (
              <button type="button" className="text-link" onClick={onOpenFavorites}>
                管理收藏夹
              </button>
            )}
          </header>

          <div className="favorites-list">
            {favoritePortRows.length ? (
              favoritePortRows.map((port) => {
                const service = port.matched_service_id ? serviceById.get(port.matched_service_id) ?? null : null;

                return (
                  <div
                    key={`${port.port}-${port.listen_address}`}
                    className="favorite-row"
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelectPort(port.port)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onSelectPort(port.port);
                      }
                    }}
                  >
                    <div className="favorite-row-main">
                      <div className="favorite-row-title">
                        <Star size={14} fill="currentColor" />
                        <span>{SCREENSHOT_MODE ? `${port.port} / ${formatProtocolLabel(port.protocol)}` : `端口 ${port.port} · ${formatProtocolLabel(port.protocol)}`}</span>
                      </div>
                      <span className="favorite-row-process">{formatOptionalText(port.process_name, service?.name ?? (SCREENSHOT_MODE ? "[No Process]" : "未检测到进程"))}</span>
                    </div>
                    <div className="favorite-row-meta mono">{port.listen_address}</div>
                    <StatusPill label={formatPortStatusLabel(port.status)} tone={portStatusTone(port.status)} />
                    <button
                      type="button"
                      className="favorite-row-action"
                      onClick={(event) => {
                        event.stopPropagation();
                        onTogglePortFavorite(port.port);
                      }}
                      aria-label={SCREENSHOT_MODE ? "Remove favorite port" : "取消端口收藏"}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                );
              })
            ) : (
              <div className="empty-state">{SCREENSHOT_MODE ? "No favorite ports yet." : "还没有收藏端口。"}</div>
            )}
          </div>

          <button type="button" className="panel-link" onClick={onOpenFavorites}>
            {SCREENSHOT_MODE ? "Manage Favorites" : "查看全部收藏"}
            <ChevronRight size={14} />
          </button>
        </article>

        <article className="panel">
          <header className="panel-header panel-header-tight">
            <div>
              <h2 className="panel-title-with-icon">
                <Activity size={14} />
                <span>{SCREENSHOT_MODE ? "Activity Log" : "活动日志"}</span>
              </h2>
            </div>

            <div className="activity-toolbar">
              <label className="activity-filter">
                <select value={activityFilter} onChange={(event) => setActivityFilter(event.target.value as "all" | ActivityTone)}>
                  {ACTIVITY_FILTERS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" className="icon-button" onClick={onClearActivity} aria-label={SCREENSHOT_MODE ? "Clear activity log" : "清空活动日志"}>
                <Trash2 size={12} />
              </button>
            </div>
          </header>

          <div className="activity-list">
            {visibleActivity.length ? (
              visibleActivity.map((entry) => (
                <article key={entry.id} className={`activity-item activity-item-${entry.tone}`}>
                  <div className="activity-item-head">
                    <div className="activity-item-title">
                      <span className={`activity-bullet activity-bullet-${entry.tone}`} />
                      <strong>{entry.title}</strong>
                    </div>
                    <span>{entry.at}</span>
                  </div>
                  <p>{entry.detail}</p>
                </article>
              ))
            ) : (
              <div className="empty-state">{SCREENSHOT_MODE ? "No activity yet." : "当前没有活动记录。"}</div>
            )}
          </div>

          <button type="button" className="panel-link" onClick={onRefresh}>
            {SCREENSHOT_MODE ? "View full log" : "刷新主控台"}
            {SCREENSHOT_MODE ? <ExternalLink size={14} /> : <RefreshCcw size={14} />}
          </button>
        </article>
      </section>
    </div>
  );
}

function getProcessGlyph(port: DashboardSnapshotDto["ports"][number], service: DashboardSnapshotDto["services"][number] | null): { icon: LucideIcon; toneClass: string } {
  const processName = port.process_name?.toLowerCase() ?? "";
  const serviceName = service?.name?.toLowerCase() ?? "";

  if (port.port === 443 || processName.includes("https") || processName.includes("ssl")) {
    return { icon: Lock, toneClass: "process-icon-amber" };
  }

  if (processName.includes("httpd") || serviceName.includes("http")) {
    return { icon: Globe, toneClass: "process-icon-cyan" };
  }

  if (processName.includes("svchost")) {
    if (serviceName.includes("dns") || processName.includes("dns")) {
      return { icon: Network, toneClass: "process-icon-blue" };
    }

    if (serviceName.includes("term") || processName.includes("term")) {
      return { icon: Monitor, toneClass: "process-icon-slate" };
    }

    return { icon: Monitor, toneClass: "process-icon-blue" };
  }

  if (processName.includes("postgres")) {
    return { icon: Database, toneClass: "process-icon-violet" };
  }

  if (processName.includes("redis")) {
    return { icon: Network, toneClass: "process-icon-red" };
  }

  if (processName.includes("mysql")) {
    return { icon: Database, toneClass: "process-icon-orange" };
  }

  if (!port.pid) {
    return { icon: FileText, toneClass: "process-icon-slate" };
  }

  return { icon: Monitor, toneClass: "process-icon-cyan" };
}

function buildPageTokens(totalPages: number, currentPage: number): Array<number | "..."> {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (currentPage <= 3) {
    return [1, 2, 3, "...", totalPages];
  }

  if (currentPage >= totalPages - 2) {
    return [1, "...", totalPages - 2, totalPages - 1, totalPages];
  }

  return [1, "...", currentPage - 1, currentPage, currentPage + 1, "...", totalPages];
}
