import { Play, Plus, RefreshCcw, Square, Star, Trash2, TriangleAlert, Zap } from "lucide-react";
import { useMemo, useState } from "react";
import { StatusPill } from "../../components/StatusPill";
import { formatOptionalText, formatPortList, formatServiceKindLabel, formatServiceStatusLabel, serviceStatusTone } from "../../lib/presentation";
import type { DashboardSnapshotDto, ManagedServiceDraftDto, ManagedServiceDto, ServiceKind } from "../../lib/types";

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
  isRefreshing: boolean;
  lastScanLabel: string;
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
  isRefreshing,
  lastScanLabel,
}: ServicesPageProps) {
  const [form, setForm] = useState<ServiceFormState>(() => createEmptyServiceForm());
  const [error, setError] = useState<string | null>(null);

  const runningCount = snapshot.services.filter((service) => service.status === "running").length;
  const attentionCount = snapshot.services.filter((service) => service.status !== "running").length;
  const favoriteCount = snapshot.services.filter((service) => service.is_favorite).length;
  const coverageRows = useMemo(
    () =>
      [...snapshot.services].sort((left, right) => {
        const leftScore = Number(left.is_favorite) * 4 + Number(left.status === "running") * 2 + left.expected_ports.length;
        const rightScore = Number(right.is_favorite) * 4 + Number(right.status === "running") * 2 + right.expected_ports.length;
        return rightScore - leftScore;
      }),
    [snapshot.services],
  );

  return (
    <div className="console-page">
      <section className="summary-strip">
        <article className="metric-card metric-card-accent">
          <div className="metric-card-label">
            <Zap size={16} />
            <span>已接管服务</span>
          </div>
          <div className="metric-card-value">{snapshot.services.length}</div>
          <div className="metric-card-caption">命令服务与 Windows 服务合并管理</div>
        </article>

        <article className="metric-card metric-card-success">
          <div className="metric-card-label">
            <Play size={16} />
            <span>运行中</span>
          </div>
          <div className="metric-card-value">{runningCount}</div>
          <div className="metric-card-caption">已经处于运行状态的服务</div>
        </article>

        <article className="metric-card metric-card-warning">
          <div className="metric-card-label">
            <TriangleAlert size={16} />
            <span>待处理</span>
          </div>
          <div className="metric-card-value">{attentionCount}</div>
          <div className="metric-card-caption">未运行或需要人工关注的服务</div>
        </article>

        <article className="metric-card metric-card-accent">
          <div className="metric-card-label">
            <Star size={16} />
            <span>已收藏</span>
          </div>
          <div className="metric-card-value">{favoriteCount}</div>
          <div className="metric-card-caption">固定在收藏夹里的重点服务</div>
        </article>

        <article className="scan-card">
          <button type="button" className="scan-refresh" onClick={onRefresh} disabled={isRefreshing}>
            <RefreshCcw size={15} />
            <span>{isRefreshing ? "刷新中" : "同步目录"}</span>
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
            <h2>服务目录</h2>
            <p>统一查看服务配置、端口覆盖和运行状态，点击某行可在右侧执行控制动作。</p>
          </div>
          <div className="panel-header-meta">
            <StatusPill label={`${snapshot.services.length} 个服务`} tone="accent" />
          </div>
        </header>

        <div className="table-shell">
          <table className="data-table">
            <thead>
              <tr>
                <th>服务</th>
                <th>类型</th>
                <th>预期端口</th>
                <th>已观测端口</th>
                <th>状态</th>
                <th>收藏</th>
                <th>动作</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.services.map((service) => {
                const isSelected = selectedServiceId === service.id;
                const isRunning = service.status === "running" || service.status === "starting";

                return (
                  <tr key={service.id} className={isSelected ? "is-selected" : undefined} onClick={() => onSelectService(service.id)}>
                    <td>
                      <div className="cell-stack">
                        <span className="strong">{service.name}</span>
                        <span className="muted-text">{formatOptionalText(service.start_command ?? service.service_name, "未配置启动入口")}</span>
                      </div>
                    </td>
                    <td>
                      <StatusPill label={formatServiceKindLabel(service.kind)} tone={service.kind === "command" ? "accent" : "neutral"} />
                    </td>
                    <td className="mono">{formatPortList(service.expected_ports)}</td>
                    <td className="mono">{formatPortList(service.observed_ports, "未发现")}</td>
                    <td>
                      <StatusPill label={formatServiceStatusLabel(service.status)} tone={serviceStatusTone(service.status)} />
                    </td>
                    <td>
                      <button
                        type="button"
                        className={`icon-button favorite-toggle ${service.is_favorite ? "is-active" : ""}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          onToggleServiceFavorite(service.id);
                        }}
                        aria-label="切换服务收藏"
                      >
                        <Star size={14} fill={service.is_favorite ? "currentColor" : "none"} />
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
                              onStopService(service.id);
                            } else {
                              onStartService(service.id);
                            }
                          }}
                          aria-label={isRunning ? "停止服务" : "启动服务"}
                        >
                          {isRunning ? <Square size={12} /> : <Play size={13} />}
                        </button>

                        <button
                          type="button"
                          className="action-icon action-icon-danger"
                          onClick={(event) => {
                            event.stopPropagation();
                            onDeleteService(service.id);
                          }}
                          aria-label="删除服务"
                        >
                          <Trash2 size={13} />
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
              <h2>快速录入</h2>
              <p>先定义服务，再把预期端口和启动入口接进统一控制台。</p>
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
              重置表单
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
                setError("命令服务需要填写启动命令。");
                return;
              }

              if (form.kind === "windows_service" && !form.serviceName.trim()) {
                setError("Windows 服务需要填写服务名。");
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
                <span>服务名称</span>
                <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="例如 web、postgres、api" />
              </label>

              <label className="field">
                <span>服务类型</span>
                <select value={form.kind} onChange={(event) => setForm((current) => ({ ...current, kind: event.target.value as ServiceKind }))}>
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
                    <input value={form.workdir} onChange={(event) => setForm((current) => ({ ...current, workdir: event.target.value }))} placeholder="D:/Code/web" />
                  </label>
                </>
              ) : (
                <label className="field field-wide">
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
              <span className="muted-text">命令服务会记录启动命令与工作目录，Windows 服务会直接走系统服务控制器。</span>
              <button type="submit" className="primary-button">
                <Plus size={16} />
                保存服务
              </button>
            </div>
          </form>
        </article>

        <article className="panel">
          <header className="panel-header panel-header-tight">
            <div>
              <h2>端口覆盖</h2>
              <p>快速判断某个服务是否已经按预期占住端口。</p>
            </div>
            <StatusPill label="按优先级排序" tone="accent" />
          </header>

          <div className="service-health-list">
            {coverageRows.length ? (
              coverageRows.slice(0, 6).map((service) => (
                <div key={service.id} className="service-health-row">
                  <div className="service-health-main">
                    <div className="service-health-copy">
                      <strong>{service.name}</strong>
                      <span>{formatOptionalText(service.start_command ?? service.service_name, "未配置启动入口")}</span>
                    </div>
                    <StatusPill label={formatServiceStatusLabel(service.status)} tone={serviceStatusTone(service.status)} />
                  </div>

                  <div className="service-health-ports">
                    <span>{`预期: ${formatPortList(service.expected_ports)}`}</span>
                    <span>{`已观测: ${formatPortList(service.observed_ports, "未发现")}`}</span>
                  </div>

                  <div className="service-health-meta">{service.expected_ports.length && !service.observed_ports.length ? "需要补齐监听端口或启动动作" : "端口覆盖已同步到控制台"}</div>
                </div>
              ))
            ) : (
              <div className="empty-state">还没有接管服务，先在左侧表单中创建一个。</div>
            )}
          </div>
        </article>
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
