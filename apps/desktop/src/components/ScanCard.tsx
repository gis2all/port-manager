import { RefreshCcw, Settings } from "lucide-react";

interface ScanCardProps {
  isRefreshing: boolean;
  lastScanLabel: string;
  onRefresh: () => void;
  refreshLabel: string;
  pollingLabel: string;
}

export function ScanCard({ isRefreshing, lastScanLabel, onRefresh, refreshLabel, pollingLabel }: ScanCardProps) {
  const lastScanPrefix = isAsciiCopy(refreshLabel) && isAsciiCopy(pollingLabel) ? "Last scan" : "最近扫描";

  return (
    <article className="scan-card">
      <div className="scan-card-main">
        <div className="scan-card-primary">
          <span className="scan-card-label">{lastScanPrefix}</span>
          <strong className="scan-card-time">{lastScanLabel}</strong>
        </div>
        <div className="scan-card-secondary">
          <Settings size={12} />
          <span>{pollingLabel}</span>
        </div>
      </div>

      <div className="scan-card-actions">
        <button type="button" className="scan-refresh" onClick={onRefresh} disabled={isRefreshing}>
          <RefreshCcw size={15} />
          <span>{refreshLabel}</span>
        </button>
      </div>
    </article>
  );
}

function isAsciiCopy(value: string): boolean {
  return /^[\x00-\x7F]*$/.test(value);
}
