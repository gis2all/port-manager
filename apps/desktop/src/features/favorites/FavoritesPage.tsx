import { Bookmark, Play, RefreshCcw, Server, Square, Star, TriangleAlert, Zap } from "lucide-react";
import { useMemo } from "react";
import { StatusPill } from "../../components/StatusPill";
import { favoritePorts, favoriteServices } from "../../lib/dashboard";
import { formatOptionalText, formatPortList, formatPortStatusLabel, formatProtocolLabel, formatServiceKindLabel, formatServiceStatusLabel, portStatusTone, serviceStatusTone } from "../../lib/presentation";
import type { DashboardSnapshotDto, ManagedServiceDto, PortDto } from "../../lib/types";

interface FavoritesPageProps {
  snapshot: DashboardSnapshotDto;
  onSelectPort: (port: number) => void;
  onSelectService: (serviceId: string) => void;
  onRefresh: () => void;
  onTogglePortFavorite: (port: number) => void;
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
          key: `port-${port.port}`,
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

  return (
    <div className="console-page">
      <section className="summary-strip">
        <article className="metric-card metric-card-accent">
          <div className="metric-card-label">
            <Bookmark size={16} />
            <span>收藏总数</span>
          </div>
          <div className="metric-card-value">{ports.length + services.length}</div>
          <div className="metric-card-caption">端口和服务统一聚合到一个收藏视图</div>
        </article>

        <article className="metric-card metric-card-success">
          <div className="metric-card-label">
            <Star size={16} />
            <span>收藏端口</span>
          </div>
          <div className="metric-card-value">{ports.length}</div>
          <div className="metric-card-caption">需要重点关注的本机端口</div>
        </article>

        <article className="metric-card metric-card-accent">
          <div className="metric-card-label">
            <Server size={16} />
            <span>收藏服务</span>
          </div>
          <div className="metric-card-value">{services.length}</div>
          <div className="metric-card-caption">常用服务与启动入口</div>
        </article>

        <article className="metric-card metric-card-warning">
          <div className="metric-card-label">
            <Zap size={16} />
            <span>可立即处理</span>
          </div>
          <div className="metric-card-value">{runningFavorites}</div>
          <div className="metric-card-caption">当前处于运行或监听状态的收藏对象</div>
        </article>

        <article className="scan-card">
          <button type="button" className="scan-refresh" onClick={onRefresh} disabled={isRefreshing}>
            <RefreshCcw size={15} />
            <span>{isRefreshing ? "刷新中" : "同步收藏"}</span>
          </button>
          <div className="scan-card-meta">
            <span>{`最近扫描 ${lastScanLabel}`}</span>
            <span>自动轮询 5 秒</span>
          </div>
        </article>
      </section>

      <section className="panel panel-table">
        <header className="panel-header">
          <div>
            <h2>收藏队列</h2>
            <p>所有星标对象共用一张主表，点击可跳回对应详情页。</p>
          </div>
          <div className="panel-header-meta">
            <StatusPill label={`${favoriteRows.length} 个收藏对象`} tone="accent" />
          </div>
        </header>

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
                  <tr key={row.key} onClick={() => onSelectPort(row.port.port)}>
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
                          onTogglePortFavorite(row.port.port);
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
              <h2>星标服务</h2>
              <p>常用服务保持在最短路径里，方便直接启停。</p>
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
              <h2>星标端口</h2>
              <p>重点端口单独列出，适合快速观察监听与风险状态。</p>
            </div>
            <StatusPill label={`${ports.length} 个端口`} tone="accent" />
          </header>

          <div className="favorites-list">
            {ports.length ? (
              ports.map((port) => (
                <div
                  key={port.port}
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
                      <span>{`端口 ${port.port} · ${formatProtocolLabel(port.protocol)}`}</span>
                    </div>
                    <span className="favorite-row-process">{formatOptionalText(port.process_name, "未检测到进程")}</span>
                  </div>
                  <div className="favorite-row-meta mono">{port.listen_address}</div>
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
