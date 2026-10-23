import { formatCurrency } from "@/lib/utils";
import type { BudgetTotals } from "@/lib/budget-summary";

// Fixed colors so the three read the same everywhere (and in the Budget chart)
export const GOAL_COLOR   = "#4F7FE8";
export const RAISED_COLOR = "#16A34A";
export const SPENT_COLOR  = "#E63946";

/**
 * Goal, raised and spent as three bars on one scale, so it's plain at a glance whether
 * the team has raised enough and how much of it is gone. Server-safe (no client code).
 */
export function BudgetGauge({ totals, compact = false }: { totals: BudgetTotals; compact?: boolean }) {
  const { goal, raised, pledged, spent, committed, fromTeamAccount } = totals;
  const scale = Math.max(goal, raised + pledged, spent, 1);
  const pct = (v: number) => `${Math.min(100, (v / scale) * 100)}%`;
  const ofGoal = (v: number) => (goal > 0 ? `${Math.round((v / goal) * 100)}%` : "—");
  const left = raised - spent;

  const rows = [
    {
      label: "Goal", color: GOAL_COLOR, value: goal,
      bar: <div className="h-full rounded-full" style={{ width: pct(goal), background: GOAL_COLOR, opacity: 0.85 }} />,
      note: "what we plan to spend",
    },
    {
      label: "Raised", color: RAISED_COLOR, value: raised,
      bar: (
        <>
          <div className="h-full rounded-full" style={{ width: pct(raised), background: RAISED_COLOR }} />
          {pledged > 0 && (
            // Pledged money still to come: a lighter, striped extension
            <div className="h-full" style={{ width: pct(pledged), background: `repeating-linear-gradient(135deg, ${RAISED_COLOR}55 0 6px, ${RAISED_COLOR}22 6px 12px)` }} />
          )}
        </>
      ),
      note: `${ofGoal(raised)} of goal${pledged > 0 ? ` · ${formatCurrency(pledged)} pledged` : ""}${fromTeamAccount > 0 && !compact ? ` · ${formatCurrency(fromTeamAccount)} from the team account` : ""}`,
    },
    {
      label: "Spent", color: SPENT_COLOR, value: spent,
      bar: <div className="h-full rounded-full" style={{ width: pct(spent), background: SPENT_COLOR }} />,
      note: `${ofGoal(spent)} of goal${committed > 0 && !compact ? ` · ${formatCurrency(committed)} on order` : ""}`,
    },
  ];

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      {rows.map((r) => (
        <div key={r.label} className="grid grid-cols-[3.75rem_1fr_auto] items-center gap-x-3 gap-y-0.5">
          <span className="text-small font-medium" style={{ color: r.color }}>{r.label}</span>
          <div className={`flex overflow-hidden rounded-full bg-(--color-surface-overlay) ${compact ? "h-2.5" : "h-3.5"}`}>{r.bar}</div>
          <span className={`text-right font-semibold text-(--color-text-primary) tabular-nums ${compact ? "text-sm" : "text-base"}`}>{formatCurrency(r.value)}</span>
          <span />
          <span className="col-span-2 text-small text-(--color-text-secondary) truncate">{r.note}</span>
        </div>
      ))}
      <p className={`text-small ${left < 0 ? "text-(--color-danger)" : "text-(--color-text-secondary)"}`}>
        {left < 0
          ? <>Spent <b>{formatCurrency(-left)}</b> more than raised</>
          : <><b className="text-(--color-text-primary)">{formatCurrency(left)}</b> raised and not yet spent{goal > raised ? <> · <b className="text-(--color-text-primary)">{formatCurrency(goal - raised)}</b> still to raise</> : null}</>}
      </p>
    </div>
  );
}
