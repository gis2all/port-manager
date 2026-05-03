import { Pin, RefreshCcw, Server, Star, TriangleAlert, Zap } from "lucide-react";
import type { DashboardSnapshotDto } from "../../lib/types";
import { favoritePorts, favoriteServices } from "../../lib/dashboard";
import { StatusPill } from "../../components/StatusPill";

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
}: FavoritesPageProps) {
  const ports = favoritePorts(snapshot);
  const services = favoriteServices(snapshot);

  return (
    <div className="page-stack">
      <section className="panel">
        <header className="panel-header">
          <div>
            <h2>收藏</h2>
            <p>把高频端口和常用服务集中到一个视图里。</p>
          </div>
          <button type="button" className="ghost-button" onClick={onRefresh}>
            <RefreshCcw size={16} />
            刷新
          </button>
        </header>

        <div className="favorites-grid">
          <article className="favorites-column">
            <div className="favorites-column-title">
              <Pin size={16} />
              <span>收藏端口</span>
            </div>

            {ports.length ? (
              <div className="favorites-list">
                {ports.map((port) => (
                  <div key={port.port} className="favorite-card" role="button" tabIndex={0} onClick={() => onSelectPort(port.port)}>
                    <div className="favorite-card-main">
                      <strong>{port.port}</strong>
                      <span className="muted-text mono">{port.listen_address}</span>
                    </div>
                    <div className="favorite-card-meta">
                      <StatusPill label={port.status === "listening" || port.status === "active" ? "监听中" : "已关闭"} tone={port.status === "closed" ? "warning" : "success"} />
                      <span className="muted-text">{port.process_name ?? "未知进程"}</span>
                    </div>
                    <div className="favorite-card-actions">
                      <button
                        type="button"
                        className="inline-action"
                        onClick={(event) => {
                          event.stopPropagation();
                          onTogglePortFavorite(port.port);
                        }}
                      >
                        <Star size={14} fill="currentColor" />
                        取消
                      </button>
                      <button
                        type="button"
                        className="inline-action danger"
                        onClick={(event) => {
                          event.stopPropagation();
                          onKillPort(port.port);
                        }}
                      >
                        <TriangleAlert size={14} />
                        结束
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">还没有收藏端口。</div>
            )}
          </article>

          <article className="favorites-column">
            <div className="favorites-column-title">
              <Server size={16} />
              <span>收藏服务</span>
            </div>

            {services.length ? (
              <div className="favorites-list">
                {services.map((service) => (
                  <div key={service.id} className="favorite-card" role="button" tabIndex={0} onClick={() => onSelectService(service.id)}>
                    <div className="favorite-card-main">
                      <strong>{service.name}</strong>
                      <span className="muted-text">{service.kind === "command" ? service.start_command : service.service_name}</span>
                    </div>
                    <div className="favorite-card-meta">
                      <StatusPill label={service.status === "running" ? "运行中" : "已停止"} tone={service.status === "running" ? "success" : "neutral"} />
                      <span className="muted-text mono">{service.expected_ports.join(", ") || "—"}</span>
                    </div>
                    <div className="favorite-card-actions">
                      <button
                        type="button"
                        className="inline-action"
                        onClick={(event) => {
                          event.stopPropagation();
                          onToggleServiceFavorite(service.id);
                        }}
                      >
                        <Star size={14} fill="currentColor" />
                        取消
                      </button>
                      <button
                        type="button"
                        className="inline-action primary"
                        onClick={(event) => {
                          event.stopPropagation();
                          if (service.status === "running") {
                            onStopService(service.id);
                          } else {
                            onStartService(service.id);
                          }
                        }}
                      >
                        <Zap size={14} />
                        {service.status === "running" ? "停止" : "启动"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">还没有收藏服务。</div>
            )}
          </article>
        </div>
      </section>
    </div>
  );
}
