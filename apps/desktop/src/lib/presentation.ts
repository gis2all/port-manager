import type { ManagedServiceDto, PortDto } from "./types";

export function formatPortStatusLabel(status: PortDto["status"]) {
  switch (status) {
    case "listening":
      return "监听中";
    case "active":
      return "活跃";
    case "closed":
      return "已关闭";
    default:
      return "未知";
  }
}

export function portStatusTone(status: PortDto["status"]) {
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

export function formatServiceStatusLabel(status: ManagedServiceDto["status"]) {
  switch (status) {
    case "running":
      return "运行中";
    case "starting":
      return "启动中";
    case "failed":
      return "异常";
    case "stopped":
      return "已停止";
    default:
      return "未知";
  }
}

export function serviceStatusTone(status: ManagedServiceDto["status"]) {
  switch (status) {
    case "running":
      return "success";
    case "starting":
      return "warning";
    case "failed":
      return "danger";
    case "stopped":
      return "neutral";
    default:
      return "neutral";
  }
}

export function formatServiceKindLabel(kind: ManagedServiceDto["kind"]) {
  return kind === "command" ? "命令服务" : "Windows 服务";
}

export function formatProtocolLabel(protocol: PortDto["protocol"]) {
  return protocol.toUpperCase();
}

export function formatPortList(ports: number[], fallback = "未配置") {
  return ports.length ? ports.join(", ") : fallback;
}

export function formatOptionalText(value: string | null | undefined, fallback = "未检测") {
  return value && value.trim() ? value : fallback;
}
