import type { ActivityEntry } from "./types";

export const SCREENSHOT_MODE = import.meta.env.DEV;

export const SCREENSHOT_WINDOW_SIZE = {
  width: 1536,
  height: 1024,
} as const;

export const SCREENSHOT_LAST_SCAN_LABEL = "10:15:30 AM";
export const SCREENSHOT_AUTO_REFRESH_LABEL = "Off";
export const SCREENSHOT_TIMESTAMP = "5/20/2025 9:12:31 AM";

export const SCREENSHOT_SYSTEM_INFO = {
  user: "Administrator",
  details: ["Windows 11 Pro 23H2 (22631.3593)", "Intel(R) Core(TM) i7-12700K", "32 GB RAM"],
  scanLabel: "Scan completed",
} as const;

export const SCREENSHOT_ACTIVITY: ActivityEntry[] = [
  {
    id: "activity-1",
    title: "Listening",
    detail: "Port 80 (TCP) is listening on 0.0.0.0:80 (httpd.exe)",
    tone: "success",
    at: "10:15:30 AM",
  },
  {
    id: "activity-2",
    title: "Active",
    detail: "Port 5357 (UDP) became active",
    tone: "accent",
    at: "10:15:28 AM",
  },
  {
    id: "activity-3",
    title: "Closed",
    detail: "Port 8080 (TCP) is closed",
    tone: "warning",
    at: "10:15:26 AM",
  },
  {
    id: "activity-4",
    title: "Listening",
    detail: "Port 443 (TCP) is listening on 0.0.0.0:443 (httpd.exe)",
    tone: "success",
    at: "10:15:24 AM",
  },
  {
    id: "activity-5",
    title: "Active",
    detail: "Port 6379 (TCP) connection established",
    tone: "accent",
    at: "10:15:20 AM",
  },
];

export function isScreenshotMode(): boolean {
  return SCREENSHOT_MODE;
}
