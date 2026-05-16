import { cn } from "@/lib/utils";

interface ProgressBarProps {
  value: number;       // 0–100
  max?: number;        // default 100
  label?: string;
  sublabel?: string;
  showValue?: boolean;
  className?: string;
  /** Thresholds for colour zones (percentages). Defaults: warn at 80, danger at 95 */
  warnAt?: number;
  dangerAt?: number;
}

export function ProgressBar({
  value,
  max = 100,
  label,
  sublabel,
  showValue = false,
  className,
  warnAt = 80,
  dangerAt = 95,
}: ProgressBarProps) {
  const pct = Math.min((value / max) * 100, 100);

  const barColor =
    pct >= dangerAt
      ? "bg-[--color-danger]"
      : pct >= warnAt
      ? "bg-[--color-warning]"
      : "bg-[--color-success]";

  return (
    <div className={cn("w-full", className)}>
      {(label || showValue) && (
        <div className="flex items-center justify-between mb-1.5">
          {label && <span className="text-small font-medium text-[--color-text-primary]">{label}</span>}
          {sublabel && <span className="text-small text-[--color-text-secondary]">{sublabel}</span>}
        </div>
      )}
      <div className="w-full h-2.5 rounded-full bg-[--color-surface-overlay] overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-300", barColor)}
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={max}
        />
      </div>
    </div>
  );
}
