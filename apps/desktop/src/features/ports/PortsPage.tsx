import { Activity, ChevronLeft, ChevronRight, Cpu, Play, RefreshCcw, Square, Star, TriangleAlert, Zap } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { StatusPill } from "../../components/StatusPill";
import { favoritePorts, findService } from "../../lib/dashboard";
import { formatOptionalText, formatPortStatusLabel, formatProtocolLabel, portStatusTone } from "../../lib/presentation";
import type { ActivityEntry, ActivityTone, DashboardSnapshotDto } from "../../lib/types";

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
const ACTIVITY_FILTERS: Array<{ label: string; value: "all" | ActivityTone }> = [
  { label: "全部事件", value: "all" },
  { label: "成功", value: "success" },
  { label: "提醒", value: "warning" },
  { label: "异常", value: "danger" },
  { label: "普通", value: "neutral" },
  { label: "活跃", value: "accent" },
];

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
  const favoritePortRows = favoritePorts(snapshot).slice(0, 4);
  const filteredActivity = activityFilter === "all" ? activity : activity.filter((entry) => entry.tone === activityFilter);
  const visibleActivity = filteredActivity.slice(0, 6);

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  return (
    <div className="console-page">
      <section className="summary-strip">
        <article className="metric-card metric-card-accent">
          <div className="metric-card-label">
            <Zap size={16} />
            <span>全部端口</span>
          </div>
          <div className="metric-card-value">{totalPorts}</div>
          <div className="metric-card-caption">本次扫描共发现 {totalPorts} 条端口记录</div>
        </article>

        <article className="metric-card metric-card-success">
          <div className="metric-card-label">
            <Cpu size={16} />
            <span>监听中</span>
          </div>
          <div className="metric-card-value">{listeningPorts}</div>
          <div className="metric-card-caption">正在监听的本机端口</div>
        </article>

        <article className="metric-card metric-card-accent">
          <div className="metric-card-label">
            <Activity size={16} />
            <span>活跃连接</span>
          </div>
          <div className="metric-card-value">{activePorts}</div>
          <div className="metric-card-caption">存在活动连接的端口</div>
        </article>

        <article className="metric-card metric-card-danger">
          <div className="metric-card-label">
            <TriangleAlert size={16} />
            <span>已关闭</span>
          </div>
          <div className="metric-card-value">{closedPorts}</div>
          <div className="metric-card-caption">当前未监听的端口</div>
        </article>

        <article className="scan-card">
          <button type="button" className="scan-refresh" onClick={onRefresh} disabled={isRefreshing}>
            <RefreshCcw size={15} />
            <span>{isRefreshing ? "刷新中" : "立即刷新"}</span>
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
            <h2>端口列表</h2>
            <p>点击任意一行，在右侧查看进程详情与关联服务动作。</p>
          </div>
          <div className="panel-header-meta">
            <StatusPill label={`第 ${currentPage} / ${totalPages} 页`} tone="accent" />
          </div>
        </header>

        <div className="table-shell">
          <table className="data-table">
            <thead>
              <tr>
                <th>端口</th>
                <th>协议</th>
                <th>PID</th>
                <th>进程 / 服务</th>
                <th>监听地址</th>
                <th>状态</th>
                <th>收藏</th>
                <th>动作</th>
              </tr>
            </thead>
            <tbody>
              {pagePorts.map((port) => {
                const service = port.matched_service_id ? serviceById.get(port.matched_service_id) ?? findService(snapshot, port.matched_service_id) ?? null : null;
                const isSelected = selectedPort === port.port;
                const canStartService = Boolean(service && port.status === "closed" && service.status !== "running" && service.status !== "starting");

                return (
                  <tr key={`${port.port}-${port.listen_address}`} className={isSelected ? "is-selected" : undefined} onClick={() => onSelectPort(port.port)}>
                    <td>
                      <div className="port-cell">
                        <span className="port-number">{port.port}</span>
                      </div>
                    </td>
                    <td>
                      <span className="protocol-chip">{formatProtocolLabel(port.protocol)}</span>
                    </td>
                    <td className="mono">{port.pid ?? "未检"}</td>
                    <td>
                      <div className="process-cell">
                        <div className="process-icon" aria-hidden="true" />
                        <div className="cell-stack">
                          <span className="process-name">{formatOptionalText(port.process_name, "未检测到进程")}</span>
                          <span className="process-service">{service?.name ?? "未关联服务"}</span>
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
                        className={`icon-button favorite-toggle ${port.is_favorite ? "is-active" : ""}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          onTogglePortFavorite(port.port);
                        }}
                        aria-label="切换端口收藏"
                      >
                        <Star size={14} fill={port.is_favorite ? "currentColor" : "none"} />
                      </button>
                    </td>
                    <td>
                      <div className="row-actions">
                        {canStartService && service ? (
                          <button
                            type="button"
                            className="action-icon action-icon-start"
                            onClick={(event) => {
                              event.stopPropagation();
                              onStartService(service.id);
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
                            onKillPort(port.port);
                          }}
                          disabled={!port.pid}
                          aria-label="结束端口进程"
                        >
                          <Square size={12} />
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
            {`显示 ${totalPorts ? startIndex + 1 : 0} - ${Math.min(startIndex + PAGE_SIZE, totalPorts)} / ${totalPorts} 条端口记录`}
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
              <h2>重点端口</h2>
              <p>把高频端口固定为收藏后，会出现在这里。</p>
            </div>
            <button type="button" className="text-link" onClick={onOpenFavorites}>
              管理收藏
            </button>
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
                        <span>{`端口 ${port.port} · ${formatProtocolLabel(port.protocol)}`}</span>
                      </div>
                      <span className="favorite-row-process">{formatOptionalText(port.process_name, service?.name ?? "未检测到进程")}</span>
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
                      aria-label="取消端口收藏"
                    >
                      <Star size={14} />
                    </button>
                  </div>
                );
              })
            ) : (
              <div className="empty-state">还没有收藏端口。</div>
            )}
          </div>

          <button type="button" className="panel-link" onClick={onOpenFavorites}>
            查看全部收藏
            <ChevronRight size={14} />
          </button>
        </article>

        <article className="panel">
          <header className="panel-header panel-header-tight">
            <div>
              <h2>活动日志</h2>
              <p>记录最近的端口与服务动作，帮助快速回看。</p>
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
              <button type="button" className="icon-button" onClick={onClearActivity} aria-label="清空活动日志">
                <Square size={12} />
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
              <div className="empty-state">当前没有活动记录。</div>
            )}
          </div>

          <button type="button" className="panel-link" onClick={onRefresh}>
            刷新主控台
            <RefreshCcw size={14} />
          </button>
        </article>
      </section>
    </div>
  );
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
