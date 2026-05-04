import { FolderSearch, Play, Plus, Square, Star, Trash2, TriangleAlert, Zap, type LucideIcon } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { useMemo, useState } from "react";
import { ScanCard } from "../../components/ScanCard";
import { SelectMenu, type SelectOption } from "../../components/SelectMenu";
import { StatusPill } from "../../components/StatusPill";
import { formatOptionalText, formatPortList, formatServiceKindLabel, formatServiceStatusLabel, serviceStatusTone } from "../../lib/presentation";
import type {
  DashboardSnapshotDto,
  DetectedServiceCandidateDto,
  ManagedServiceDraftDto,
  ManagedServiceDto,
  ServiceKind,
} from "../../lib/types";

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
  onDetectProject: (root: string) => Promise<DetectedServiceCandidateDto[]>;
  isRefreshing: boolean;
  lastScanLabel: string;
}

interface ServiceFormState {
  name: string;
  kind: ServiceKind;
  serviceName: string;
  workdir: string;
  startCommand: string;
  stopCommand: string;
  autoDetectedFrom: string;
  expectedPortsText: string;
}

interface SummaryMetricCard {
  key: string;
  label: string;
  value: number;
  caption: string;
  icon: LucideIcon;
  toneClass: string;
}

const SERVICE_KIND_OPTIONS: ReadonlyArray<SelectOption<ServiceKind>> = [
  { value: "command", label: "命令服务" },
  { value: "windows_service", label: "Windows 服务" },
];

function createEmptyServiceForm(): ServiceFormState {
  return {
    name: "",
    kind: "command",
    serviceName: "",
    workdir: "",
    startCommand: "",
    stopCommand: "",
    autoDetectedFrom: "",
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
  onDetectProject,
  isRefreshing,
  lastScanLabel,
}: ServicesPageProps) {
  const [form, setForm] = useState<ServiceFormState>(() => createEmptyServiceForm());
  const [error, setError] = useState<string | null>(null);
  const [detectRoot, setDetectRoot] = useState("");
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectedCandidates, setDetectedCandidates] = useState<DetectedServiceCandidateDto[]>([]);

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
  const summaryCards: SummaryMetricCard[] = [
    {
      key: "total",
      label: "已接管服务",
      value: snapshot.services.length,
      caption: "统一服务清单",
      icon: Zap,
      toneClass: "metric-card-accent",
    },
    {
      key: "running",
      label: "运行中",
      value: runningCount,
      caption: "当前正在运行",
      icon: Play,
      toneClass: "metric-card-success",
    },
    {
      key: "attention",
      label: "待处理",
      value: attentionCount,
      caption: "需要人工关注",
      icon: TriangleAlert,
      toneClass: "metric-card-warning",
    },
    {
      key: "favorites",
      label: "已收藏",
      value: favoriteCount,
      caption: "重点服务收藏",
      icon: Star,
      toneClass: "metric-card-accent",
    },
  ];

  return (
    <div className="console-page console-page-services">
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
          refreshLabel={isRefreshing ? "刷新中" : "同步目录"}
          pollingLabel="自动轮询 5 秒"
        />
      </section>

      <section className="panel panel-table">
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
              <h2>服务健康</h2>
            </div>
            <StatusPill label={`${favoriteCount} 个收藏`} tone="accent" />
          </header>

          <div className="service-health-list">
            {coverageRows.length ? (
              coverageRows.slice(0, 5).map((service) => (
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
              <div className="empty-state">还没有接管服务，先在右侧登记一个。</div>
            )}
          </div>
        </article>

        <article className="panel panel-service-form">
          <header className="panel-header panel-header-tight">
            <div>
              <h2>登记服务</h2>
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
                stop_command: form.kind === "command" && form.stopCommand.trim() ? form.stopCommand.trim() : null,
                auto_detected_from: form.autoDetectedFrom.trim() ? form.autoDetectedFrom.trim() : null,
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
                <SelectMenu
                  value={form.kind}
                  options={SERVICE_KIND_OPTIONS}
                  onChange={(value) => setForm((current) => ({ ...current, kind: value }))}
                  ariaLabel="选择服务类型"
                  className="field-select-menu"
                  triggerClassName="field-select-trigger"
                />
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

                  <label className="field field-wide">
                    <span>停止命令</span>
                    <input
                      value={form.stopCommand}
                      onChange={(event) => setForm((current) => ({ ...current, stopCommand: event.target.value }))}
                      placeholder="npm run stop"
                    />
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

              <label className="field field-wide">
                <span>检测来源</span>
                <input
                  value={form.autoDetectedFrom}
                  onChange={(event) => setForm((current) => ({ ...current, autoDetectedFrom: event.target.value }))}
                  placeholder="package.json / docker-compose.yml / pom.xml"
                />
              </label>
            </div>

            {error ? <div className="form-error">{error}</div> : null}

            <div className="service-detect-block">
              <div className="service-detect-row">
                <input
                  value={detectRoot}
                  onChange={(event) => setDetectRoot(event.target.value)}
                  placeholder="输入项目目录，例如 D:/Code/web"
                />
                <button
                  type="button"
                  className="ghost-button"
                  onClick={async () => {
                    if (typeof window === "undefined") {
                      return;
                    }
                    const selected = await open({
                      directory: true,
                      multiple: false,
                    });
                    if (typeof selected === "string") {
                      setDetectRoot(selected);
                    }
                  }}
                >
                  浏览目录
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  disabled={!detectRoot.trim() || isDetecting}
                  onClick={async () => {
                    try {
                      setIsDetecting(true);
                      setError(null);
                      const candidates = await onDetectProject(detectRoot.trim());
                      setDetectedCandidates(candidates);
                    } catch (detectError) {
                      setError(detectError instanceof Error ? detectError.message : String(detectError));
                    } finally {
                      setIsDetecting(false);
                    }
                  }}
                >
                  <FolderSearch size={16} />
                  {isDetecting ? "识别中" : "从项目识别"}
                </button>
              </div>

              {detectedCandidates.length ? (
                <div className="service-detect-list">
                  {detectedCandidates.map((candidate, index) => (
                    <button
                      key={`${candidate.name}-${candidate.detected_from}-${index}`}
                      type="button"
                      className="service-detect-item"
                      onClick={() => {
                        setForm({
                          name: candidate.name,
                          kind: "command",
                          serviceName: "",
                          workdir: candidate.workdir,
                          startCommand: candidate.start_command,
                          stopCommand: "",
                          autoDetectedFrom: candidate.detected_from,
                          expectedPortsText: candidate.expected_ports.join(", "),
                        });
                        setError(null);
                      }}
                    >
                      <div className="service-detect-copy">
                        <strong>{candidate.name}</strong>
                        <span>{candidate.start_command}</span>
                      </div>
                      <div className="service-detect-meta">
                        <span>{candidate.detected_from}</span>
                        <span>{formatPortList(candidate.expected_ports, "未识别端口")}</span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="form-footer">
              <button type="submit" className="primary-button">
                <Plus size={16} />
                保存服务
              </button>
            </div>
          </form>
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
