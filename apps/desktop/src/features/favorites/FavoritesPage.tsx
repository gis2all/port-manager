import { Bookmark, Play, Server, Square, Star, TriangleAlert, Zap, type LucideIcon } from "lucide-react";
import { useMemo } from "react";
import { ScanCard } from "../../components/ScanCard";
import { StatusPill } from "../../components/StatusPill";
import { favoritePorts, favoriteServices, getPortRowKey } from "../../lib/dashboard";
import { formatOptionalText, formatPortList, formatPortStatusLabel, formatProtocolLabel, formatServiceKindLabel, formatServiceStatusLabel, portStatusTone, serviceStatusTone } from "../../lib/presentation";
import type { DashboardSnapshotDto, ManagedServiceDto, PortDto } from "../../lib/types";

interface FavoritesPageProps {
  snapshot: DashboardSnapshotDto;
  onSelectPort: (port: PortDto) => void;
  onSelectService: (serviceId: string) => void;
  onRefresh: () => void;
  onTogglePortFavorite: (port: PortDto) => void;
  onToggleServiceFavorite: (serviceId: string) => void;
  onKillPort: (port: number) => void;
  onStartService: (serviceId: string) => void;
  onStopService: (serviceId: string) => void;
  isRefreshing: boolean;
  lastScanLabel: string;
}

type FavoriteTableRow =
  | { key: string; kind: "port"; port: PortDto; service: ManagedServiceDto | null }
  | { key: string; kind: "service"; service: ManagedServiceDto };

interface SummaryMetricCard {
  key: string;
  label: string;
  value: number;
  caption: string;
  icon: LucideIcon;
  toneClass: string;
}

export function FavoritesPage({
  snapshot,
  onSelectPort,
  onSelectService,
  onRefresh,
  onTogglePortFavorite,
  onToggleServiceFavorite,
  onKillPort,
  onStartService,
  onStopService,
  isRefreshing,
  lastScanLabel,
}: FavoritesPageProps) {
  const ports = favoritePorts(snapshot);
  const services = favoriteServices(snapshot);
  const runningFavorites = ports.filter((port) => port.status === "listening" || port.status === "active").length + services.filter((service) => service.status === "running").length;
  const linkedServiceById = useMemo(() => new Map(snapshot.services.map((service) => [service.id, service])), [snapshot.services]);
  const favoriteRows = useMemo<FavoriteTableRow[]>(
    () =>
      [
        ...ports.map((port) => ({
          key: getPortRowKey(port),
          kind: "port" as const,
          port,
          service: port.matched_service_id ? linkedServiceById.get(port.matched_service_id) ?? null : null,
        })),
        ...services.map((service) => ({
          key: `service-${service.id}`,
          kind: "service" as const,
          service,
        })),
      ].sort((left, right) => {
        if (left.kind !== right.kind) {
          return left.kind === "service" ? -1 : 1;
        }

        if (left.kind === "service" && right.kind === "service") {
          return Number(right.service.status === "running") - Number(left.service.status === "running");
        }

        if (left.kind === "port" && right.kind === "port") {
          return Number(right.port.status !== "closed") - Number(left.port.status !== "closed");
        }

        return 0;
      }),
    [linkedServiceById, ports, services],
  );
  const summaryCards: SummaryMetricCard[] = [
    {
      key: "total",
      label: "收藏总数",
      value: ports.length + services.length,
      caption: "统一收藏视图",
      icon: Bookmark,
      toneClass: "metric-card-accent",
    },
    {
      key: "ports",
      label: "收藏端口",
      value: ports.length,
      caption: "重点端口总览",
      icon: Star,
      toneClass: "metric-card-success",
    },
    {
      key: "services",
      label: "收藏服务",
      value: services.length,
      caption: "常用服务入口",
      icon: Server,
      toneClass: "metric-card-accent",
    },
    {
      key: "running",
      label: "可立即处理",
      value: runningFavorites,
      caption: "当前可直接处理",
      icon: Zap,
      toneClass: "metric-card-warning",
    },
  ];

  return (
    <div className="console-page">
      <section className="summary-strip">
        {summaryCards.map(({ key, label, value, icon: Icon, toneClass }) => (
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
          </article>
        ))}

        <ScanCard
          isRefreshing={isRefreshing}
          lastScanLabel={lastScanLabel}
          onRefresh={onRefresh}
          refreshLabel={isRefreshing ? "刷新中" : "同步收藏"}
          pollingLabel="自动轮询 5 秒"
        />
      </section>

      <section className="panel panel-table">
        <div className="table-shell">
          <table className="data-table">
            <thead>
              <tr>
                <th>对象</th>
                <th>类别</th>
                <th>摘要</th>
                <th>状态</th>
                <th>收藏</th>
                <th>动作</th>
              </tr>
            </thead>
            <tbody>
              {favoriteRows.map((row) => {
                if (row.kind === "service") {
                  const isRunning = row.service.status === "running" || row.service.status === "starting";

                  return (
                    <tr key={row.key} onClick={() => onSelectService(row.service.id)}>
                      <td>
                        <div className="cell-stack">
                          <span className="strong">{row.service.name}</span>
                          <span className="muted-text">{formatOptionalText(row.service.start_command ?? row.service.service_name, "未配置启动入口")}</span>
                        </div>
                      </td>
                      <td>
                        <StatusPill label={formatServiceKindLabel(row.service.kind)} tone={row.service.kind === "command" ? "accent" : "neutral"} />
                      </td>
                      <td className="mono">{formatPortList(row.service.expected_ports)}</td>
                      <td>
                        <StatusPill label={formatServiceStatusLabel(row.service.status)} tone={serviceStatusTone(row.service.status)} />
                      </td>
                      <td>
                        <button
                          type="button"
                          className="icon-button favorite-toggle is-active"
                          onClick={(event) => {
                            event.stopPropagation();
                            onToggleServiceFavorite(row.service.id);
                          }}
                          aria-label="取消服务收藏"
                        >
                          <Star size={14} fill="currentColor" />
                        </button>
                      </td>
                      <td>
                        <div className="row-actions">
                          <button
                            type="button"
                            className={isRunning ? "action-icon" : "action-icon action-icon-start"}
                            onClick={(event) => {
                              event.stopPropagation();
                              if (isRunning) {
                                onStopService(row.service.id);
                              } else {
                                onStartService(row.service.id);
                              }
                            }}
                            aria-label={isRunning ? "停止服务" : "启动服务"}
                          >
                            {isRunning ? <Square size={12} /> : <Play size={13} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }

                const linkedService = row.service;
                const canStartService = Boolean(linkedService && row.port.status === "closed" && linkedService.status !== "running" && linkedService.status !== "starting");

                return (
                  <tr key={row.key} onClick={() => onSelectPort(row.port)}>
                    <td>
                      <div className="cell-stack">
                        <span className="strong">{`端口 ${row.port.port} · ${formatProtocolLabel(row.port.protocol)}`}</span>
                        <span className="muted-text">{formatOptionalText(row.port.process_name, linkedService?.name ?? "未检测到进程")}</span>
                      </div>
                    </td>
                    <td>
                      <StatusPill label="端口" tone="neutral" />
                    </td>
                    <td className="mono">{`${row.port.listen_address}${linkedService ? ` · ${linkedService.name}` : ""}`}</td>
                    <td>
                      <StatusPill label={formatPortStatusLabel(row.port.status)} tone={portStatusTone(row.port.status)} />
                    </td>
                    <td>
                      <button
                        type="button"
                        className="icon-button favorite-toggle is-active"
                        onClick={(event) => {
                          event.stopPropagation();
                          onTogglePortFavorite(row.port);
                        }}
                        aria-label="取消端口收藏"
                      >
                        <Star size={14} fill="currentColor" />
                      </button>
                    </td>
                    <td>
                      <div className="row-actions">
                        {canStartService && linkedService ? (
                          <button
                            type="button"
                            className="action-icon action-icon-start"
                            onClick={(event) => {
                              event.stopPropagation();
                              onStartService(linkedService.id);
                            }}
                            aria-label="启动关联服务"
                          >
                            <Play size={13} />
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="action-icon action-icon-danger"
                          onClick={(event) => {
                            event.stopPropagation();
                            onKillPort(row.port.port);
                          }}
                          disabled={!row.port.pid}
                          aria-label="结束端口进程"
                        >
                          <TriangleAlert size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bottom-grid">
        <article className="panel">
          <header className="panel-header panel-header-tight">
            <div>
              <h2>收藏服务</h2>
            </div>
            <StatusPill label={`${services.length} 个服务`} tone="accent" />
          </header>

          <div className="favorites-list">
            {services.length ? (
              services.map((service) => {
                const isRunning = service.status === "running" || service.status === "starting";

                return (
                  <div
                    key={service.id}
                    className="favorite-row"
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelectService(service.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onSelectService(service.id);
                      }
                    }}
                  >
                    <div className="favorite-row-main">
                      <div className="favorite-row-title">
                        <Server size={14} />
                        <span>{service.name}</span>
                      </div>
                      <span className="favorite-row-process">{formatServiceKindLabel(service.kind)}</span>
                    </div>
                    <div className="favorite-row-meta mono">{formatPortList(service.expected_ports)}</div>
                    <StatusPill label={formatServiceStatusLabel(service.status)} tone={serviceStatusTone(service.status)} />
                    <button
                      type="button"
                      className="favorite-row-action"
                      onClick={(event) => {
                        event.stopPropagation();
                        if (isRunning) {
                          onStopService(service.id);
                        } else {
                          onStartService(service.id);
                        }
                      }}
                      aria-label={isRunning ? "停止服务" : "启动服务"}
                    >
                      {isRunning ? <Square size={12} /> : <Play size={13} />}
                    </button>
                  </div>
                );
              })
            ) : (
              <div className="empty-state">还没有收藏服务。</div>
            )}
          </div>
        </article>

        <article className="panel">
          <header className="panel-header panel-header-tight">
            <div>
              <h2>收藏端口摘要</h2>
            </div>
            <StatusPill label={`${ports.length} 个端口`} tone="accent" />
          </header>

          <div className="favorites-list favorite-port-list">
            {ports.length ? (
              ports.map((port) => (
                <div
                  key={getPortRowKey(port)}
                  className="favorite-row favorite-port-row"
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelectPort(port)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelectPort(port);
                    }
                  }}
                >
                  <div className="favorite-row-main">
                    <div className="favorite-row-title">
                      <Star size={14} fill="currentColor" />
                      <span>{`端口 ${port.port} · ${formatProtocolLabel(port.protocol)}`}</span>
                    </div>
                    <span className="favorite-row-process">{formatOptionalText(port.process_name, "未检测到进程")}</span>
                  </div>
                  <StatusPill label={formatPortStatusLabel(port.status)} tone={portStatusTone(port.status)} />
                  <button
                    type="button"
                    className="favorite-row-action"
                    onClick={(event) => {
                      event.stopPropagation();
                      onKillPort(port.port);
                    }}
                    disabled={!port.pid}
                    aria-label="结束端口进程"
                  >
                    <TriangleAlert size={13} />
                  </button>
                </div>
              ))
            ) : (
              <div className="empty-state">还没有收藏端口。</div>
            )}
          </div>
        </article>
      </section>
    </div>
  );
}
