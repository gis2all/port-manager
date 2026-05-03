import { Plus, RefreshCcw, Star, SquarePen, Trash2, Zap } from "lucide-react";
import { useMemo, useState } from "react";
import type { DashboardSnapshotDto, ManagedServiceDraftDto, ManagedServiceDto, ServiceKind } from "../../lib/types";
import { StatusPill } from "../../components/StatusPill";

interface ServicesPageProps {
  snapshot: DashboardSnapshotDto;
  selectedServiceId: string | null;
  onSelectService: (serviceId: string) => void;
  onRefresh: () => void;
  onToggleServiceFavorite: (serviceId: string) => void;
  onStartService: (serviceId: string) => void;
  onStopService: (serviceId: string) => void;
  onDeleteService: (serviceId: string) => void;
  onSaveService: (draft: ManagedServiceDraftDto) => void;
}

interface ServiceFormState {
  name: string;
  kind: ServiceKind;
  serviceName: string;
  workdir: string;
  startCommand: string;
  expectedPortsText: string;
}

function createEmptyServiceForm(): ServiceFormState {
  return {
    name: "",
    kind: "command",
    serviceName: "",
    workdir: "",
    startCommand: "",
    expectedPortsText: "3000",
  };
}

export function ServicesPage({
  snapshot,
  selectedServiceId,
  onSelectService,
  onRefresh,
  onToggleServiceFavorite,
  onStartService,
  onStopService,
  onDeleteService,
  onSaveService,
}: ServicesPageProps) {
  const [form, setForm] = useState<ServiceFormState>(() => createEmptyServiceForm());
  const [error, setError] = useState<string | null>(null);

  const serviceStats = useMemo(
    () => [
      { label: "已配置", value: snapshot.services.length.toString() },
      { label: "运行中", value: snapshot.services.filter((service) => service.status === "running").length.toString() },
      { label: "收藏", value: snapshot.services.filter((service) => service.is_favorite).length.toString() },
    ],
    [snapshot.services],
  );

  return (
    <div className="page-stack">
      <section className="summary-grid summary-grid-compact">
        {serviceStats.map((item) => (
          <article key={item.label} className="metric-card metric-card-neutral">
            <div className="metric-card-label">
              <SquarePen size={16} />
              <span>{item.label}</span>
            </div>
            <div className="metric-card-value">{item.value}</div>
          </article>
        ))}
      </section>

      <section className="panel">
        <header className="panel-header">
          <div>
            <h2>受管服务</h2>
            <p>手动登记 Windows 服务或命令型服务，然后直接启动和停止。</p>
          </div>
          <button type="button" className="ghost-button" onClick={onRefresh}>
            <RefreshCcw size={16} />
            刷新
          </button>
        </header>

        <div className="table-shell">
          <table className="data-table">
            <thead>
              <tr>
                <th>名称</th>
                <th>类型</th>
                <th>预期端口</th>
                <th>状态</th>
                <th>收藏</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.services.map((service) => {
                const isSelected = selectedServiceId === service.id;

                return (
                  <tr
                    key={service.id}
                    className={isSelected ? "is-selected" : undefined}
                    onClick={() => onSelectService(service.id)}
                  >
                    <td>
                      <div className="cell-stack">
                        <span className="strong">{service.name}</span>
                        <span className="muted-text">{service.start_command ?? service.service_name ?? "—"}</span>
                      </div>
                    </td>
                    <td>
                      <StatusPill
                        label={service.kind === "command" ? "命令服务" : "Windows 服务"}
                        tone={service.kind === "command" ? "accent" : "neutral"}
                      />
                    </td>
                    <td className="mono">{service.expected_ports.length ? service.expected_ports.join(", ") : "—"}</td>
                    <td>
                      <StatusPill label={service.status === "running" ? "运行中" : service.status === "starting" ? "启动中" : service.status === "failed" ? "失败" : "已停止"} tone={serviceStatusTone(service.status)} />
                      {service.observed_ports.length ? (
                        <div className="sub-status muted-text mono">当前: {service.observed_ports.join(", ")}</div>
                      ) : null}
                    </td>
                    <td>
                      <button
                        type="button"
                        className={`icon-button ${service.is_favorite ? "is-active" : ""}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          onToggleServiceFavorite(service.id);
                        }}
                        aria-label="收藏服务"
                      >
                        <Star size={14} fill={service.is_favorite ? "currentColor" : "none"} />
                      </button>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          type="button"
                          className={`row-action ${service.status === "running" ? "muted" : "primary"}`}
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
                        <button
                          type="button"
                          className="row-action danger"
                          onClick={(event) => {
                            event.stopPropagation();
                            onDeleteService(service.id);
                          }}
                        >
                          <Trash2 size={14} />
                          删除
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

      <section className="panel">
        <header className="panel-header">
          <div>
            <h2>快速新增</h2>
            <p>填一条服务定义即可绑定端口、收藏和启动控制。</p>
          </div>
          <button
            type="button"
            className="ghost-button"
            onClick={() => {
              setForm(createEmptyServiceForm());
              setError(null);
            }}
          >
            <Plus size={16} />
            重置
          </button>
        </header>

        <form
          className="service-form"
          onSubmit={(event) => {
            event.preventDefault();
            const normalizedName = form.name.trim();
            const normalizedPorts = parsePortList(form.expectedPortsText);

            if (!normalizedName) {
              setError("请输入服务名称。");
              return;
            }

            if (form.kind === "command" && !form.startCommand.trim()) {
              setError("命令服务需要启动命令。");
              return;
            }

            if (form.kind === "windows_service" && !form.serviceName.trim()) {
              setError("Windows 服务需要服务名称。");
              return;
            }

            onSaveService({
              name: normalizedName,
              kind: form.kind,
              service_name: form.kind === "windows_service" ? form.serviceName.trim() : null,
              workdir: form.kind === "command" && form.workdir.trim() ? form.workdir.trim() : null,
              start_command: form.kind === "command" && form.startCommand.trim() ? form.startCommand.trim() : null,
              expected_ports: normalizedPorts,
            });

            setForm(createEmptyServiceForm());
            setError(null);
          }}
        >
          <div className="form-grid">
            <label className="field">
              <span>名称</span>
              <input
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="例如 web、postgres、api"
              />
            </label>

            <label className="field">
              <span>类型</span>
              <select
                value={form.kind}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    kind: event.target.value as ServiceKind,
                  }))
                }
              >
                <option value="command">命令服务</option>
                <option value="windows_service">Windows 服务</option>
              </select>
            </label>

            {form.kind === "command" ? (
              <>
                <label className="field">
                  <span>启动命令</span>
                  <input
                    value={form.startCommand}
                    onChange={(event) => setForm((current) => ({ ...current, startCommand: event.target.value }))}
                    placeholder="npm run dev"
                  />
                </label>

                <label className="field">
                  <span>工作目录</span>
                  <input
                    value={form.workdir}
                    onChange={(event) => setForm((current) => ({ ...current, workdir: event.target.value }))}
                    placeholder="D:/Code/web"
                  />
                </label>
              </>
            ) : (
              <label className="field">
                <span>Windows 服务名</span>
                <input
                  value={form.serviceName}
                  onChange={(event) => setForm((current) => ({ ...current, serviceName: event.target.value }))}
                  placeholder="postgresql-x64-17"
                />
              </label>
            )}

            <label className="field field-wide">
              <span>预期端口</span>
              <input
                value={form.expectedPortsText}
                onChange={(event) => setForm((current) => ({ ...current, expectedPortsText: event.target.value }))}
                placeholder="3000, 5173"
              />
            </label>
          </div>

          {error ? <div className="form-error">{error}</div> : null}
          <div className="form-footer">
            <span className="muted-text">命令服务会在启动时记录进程状态，Windows 服务则直接走系统服务控制器。</span>
            <button type="submit" className="primary-button">
              <Plus size={16} />
              保存服务
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function parsePortList(value: string): number[] {
  return value
    .split(/[\s,]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => Number(item))
    .filter((port) => Number.isInteger(port) && port > 0 && port < 65536);
}

function serviceStatusTone(status: ManagedServiceDto["status"]) {
  switch (status) {
    case "running":
      return "success";
    case "starting":
      return "warning";
    case "failed":
      return "danger";
    default:
      return "neutral";
  }
}
