type StatusTone = "neutral" | "success" | "warning" | "danger" | "accent";

interface StatusPillProps {
  label: string;
  tone?: StatusTone;
}

export function StatusPill({ label, tone = "neutral" }: StatusPillProps) {
  return (
    <span className={`status-pill status-pill-${tone}`}>
      <span className="status-pill-dot" />
      <span>{label}</span>
    </span>
  );
}
