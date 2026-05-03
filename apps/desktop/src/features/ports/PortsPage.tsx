import {
  ChevronLeft,
  ChevronRight,
  Cpu,
  MoreHorizontal,
  Play,
  RefreshCcw,
  Server,
  Star,
  Trash2,
  TriangleAlert,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { StatusPill } from "../../components/StatusPill";
import { favoritePorts, findService } from "../../lib/dashboard";
import type { ActivityEntry, ActivityTone, DashboardSnapshotDto, PortDto } from "../../lib/types";

interface PortsPageProps {
  snapshot: DashboardSnapshotDto;
  activity: ActivityEntry[];
  selectedPort: number | null;
  onSelectPort: (port: number) => void;
  onRefresh: () => void;
  onTogglePortFavorite: (port: number) => void;
  onKillPort: (port: number) => void;
  onStartService: (serviceId: string) => void;
  onStopService: (serviceId: string) => void;
  onToggleServiceFavorite: (serviceId: string) => void;
  onOpenFavorites: () => void;
  onClearActivity: () => void;
  isRefreshing: boolean;
  lastScanLabel: string;
}

const PAGE_SIZE = 9;
const ACTIVITY_FILTERS: Array<{ label: string; value: "all" | ActivityTone }> = [
  { label: "All Events", value: "all" },
  { label: "Success", value: "success" },
  { label: "Warning", value: "warning" },
  { label: "Danger", value: "danger" },
  { label: "Neutral", value: "neutral" },
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
  onStopService,
  onToggleServiceFavorite,
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
  const visibleActivity = filteredActivity.slice(0, 6);

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  return (
    <div className="ports-page">
      <section className="summary-strip">
        <article className="metric-card metric-card-ports metric-card-total">
          <div className="metric-card-label">
            <Zap size={16} />
            <span>Total Ports</span>
          </div>
          <div className="metric-card-value">{totalPorts}</div>
          <div className="metric-card-caption">All scanned</div>
        </article>

        <article className="metric-card metric-card-ports metric-card-listening">
          <div className="metric-card-label">
            <Cpu size={16} />
            <span>Listening</span>
          </div>
          <div className="metric-card-value">{listeningPorts}</div>
          <div className="metric-card-caption">Active &amp; listening</div>
        </article>

        <article className="metric-card metric-card-ports metric-card-active">
          <div className="metric-card-label">
            <Server size={16} />
            <span>Active</span>
          </div>
          <div className="metric-card-value">{activePorts}</div>
          <div className="metric-card-caption">Established connections</div>
        </article>

        <article className="metric-card metric-card-ports metric-card-closed">
          <div className="metric-card-label">
            <TriangleAlert size={16} />
            <span>Closed</span>
          </div>
          <div className="metric-card-value">{closedPorts}</div>
          <div className="metric-card-caption">Not listening</div>
        </article>

        <article className="scan-card">
          <button type="button" className="scan-refresh" onClick={onRefresh} disabled={isRefreshing}>
            <RefreshCcw size={15} />
            <span>Refresh</span>
          </button>
          <div className="scan-card-meta">
            <span>Last scan: {lastScanLabel}</span>
            <span>Auto-refresh: Off</span>
          </div>
        </article>
      </section>

      <section className="panel panel-table">
        <div className="table-shell table-shell-ports">
          <table className="data-table data-table-ports">
            <thead>
              <tr>
                <th>Port</th>
                <th>Protocol</th>
                <th>PID</th>
                <th>Process</th>
                <th>Listen Address</th>
                <th>Status</th>
                <th>Favorite</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pagePorts.map((port) => {
                const service = port.matched_service_id ? serviceById.get(port.matched_service_id) ?? findService(snapshot, port.matched_service_id) ?? null : null;
                const isSelected = selectedPort === port.port;
                const canStartService = Boolean(service && port.status === "closed");

                return (
                  <tr
                    key={`${port.port}-${port.listen_address}`}
                    className={isSelected ? "is-selected" : undefined}
                    onClick={() => onSelectPort(port.port)}
                  >
                    <td>
                      <div className="port-cell">
                        <span className="port-number">{port.port}</span>
                      </div>
                    </td>
                    <td>
                      <span className="protocol-chip">{port.protocol.toUpperCase()}</span>
                    </td>
                    <td className="mono">{port.pid ?? "0"}</td>
                    <td>
                      <div className="process-cell">
                        <div className="process-icon" aria-hidden="true" />
                        <div className="cell-stack">
                          <span className="process-name">{port.process_name ?? "[No Process]"}</span>
                          {service ? <span className="process-service">{service.name}</span> : null}
                        </div>
                      </div>
                    </td>
                    <td className="mono">{port.listen_address}</td>
                    <td>
                      <StatusPill label={portStatusLabel(port.status)} tone={portStatusTone(port.status)} />
                    </td>
                    <td>
                      <button
                        type="button"
                        className={`icon-button favorite-toggle ${port.is_favorite ? "is-active" : ""}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          onTogglePortFavorite(port.port);
                        }}
                        aria-label="Toggle favorite"
                      >
                        <Star size={14} fill={port.is_favorite ? "currentColor" : "none"} />
                      </button>
                    </td>
                    <td>
                      <div className="row-actions row-actions-compact">
                        {canStartService && service ? (
                          <button
                            type="button"
                            className="action-icon action-icon-start"
                            onClick={(event) => {
                              event.stopPropagation();
                              onStartService(service.id);
                            }}
                            aria-label="Start service"
                          >
                            <Play size={13} />
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="action-icon"
                          onClick={(event) => event.stopPropagation()}
                          aria-label="More actions"
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
            Showing {snapshot.ports.length ? startIndex + 1 : 0} to {Math.min(startIndex + PAGE_SIZE, totalPorts)} of {totalPorts} ports
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
        <article className="panel favorites-panel">
          <header className="panel-header panel-header-tight">
            <div>
              <h2>
                <Star size={16} />
                Favorites ({favoritePortRows.length})
              </h2>
            </div>
            <button type="button" className="text-link" onClick={onOpenFavorites}>
              Manage Favorites
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
                        <span className="mono">{port.port} / {port.protocol.toUpperCase()}</span>
                      </div>
                      <span className="favorite-row-process">{port.process_name ?? service?.name ?? "[No Process]"}</span>
                    </div>
                    <div className="favorite-row-meta mono">{port.listen_address}</div>
                    <StatusPill label={portStatusLabel(port.status)} tone={portStatusTone(port.status)} />
                    <button
                      type="button"
                      className="favorite-row-action"
                      onClick={(event) => {
                        event.stopPropagation();
                        onTogglePortFavorite(port.port);
                      }}
                      aria-label="Remove favorite"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })
            ) : (
              <div className="empty-state">No favorite ports yet.</div>
            )}
          </div>

          <button type="button" className="panel-link" onClick={onOpenFavorites}>
            View all favorites
            <ChevronRight size={14} />
          </button>
        </article>

        <article className="panel activity-panel">
          <header className="panel-header panel-header-tight">
            <div>
              <h2>
                <ActivityIcon />
                Activity Log
              </h2>
              <p>Recent port and service events.</p>
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
              <button type="button" className="icon-button" onClick={onClearActivity} aria-label="Clear log">
                <Trash2 size={14} />
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
              <div className="empty-state">No activity yet.</div>
            )}
          </div>

          <button type="button" className="panel-link" onClick={onRefresh}>
            View full log
            <ChevronRight size={14} />
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

function ActivityIcon() {
  return <Zap size={16} />;
}
