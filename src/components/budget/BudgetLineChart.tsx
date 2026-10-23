"use client";

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from "recharts";
import { formatCurrency } from "@/lib/utils";

// Fixed colors so goal / raised / spent read the same everywhere
export const GOAL_COLOR   = "#4F7FE8";
export const RAISED_COLOR = "#16A34A";
export const SPENT_COLOR  = "#E63946";

/** Money in or out on a date (ISO) */
export interface MoneyPoint { date: string; amount: number }

const DAY = 86_400_000;
const label = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/**
 * Goal, raised and spent week by week, from the earliest of kickoff and the first money in
 * or out, to the season's end (or `until`, e.g. today for a short view).
 */
export function budgetSeries(kickoffDate: string, endDate: string, goal: number, spent: MoneyPoint[], raised: MoneyPoint[], until?: string) {
  const firsts = [...spent, ...raised].map((p) => new Date(p.date).getTime());
  const start = Math.min(new Date(kickoffDate).getTime(), ...firsts);
  const end = until ? Math.min(new Date(endDate).getTime(), Math.max(start, new Date(until).getTime())) : new Date(endDate).getTime();
  const sum = (list: MoneyPoint[], upTo: number) => list.reduce((s, p) => (new Date(p.date).getTime() <= upTo ? s + p.amount : s), 0);
  const points: { week: string; goal: number; raised: number; spent: number }[] = [];
  for (let t = start; ; t += 7 * DAY) {
    const at = Math.min(t, end);
    points.push({ week: label(new Date(at)), goal, raised: sum(raised, at), spent: sum(spent, at) });
    if (at >= end) break;
  }
  return points;
}

function ChartTooltip({ active, payload, label: l }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-(--color-border) px-3 py-2 text-xs" style={{ backgroundColor: "var(--color-surface)", boxShadow: "var(--shadow-md)" }}>
      <p className="font-medium text-(--color-text-primary) mb-1">{l}</p>
      {payload.map((p) => <p key={p.name} style={{ color: p.color }}>{p.name}: {formatCurrency(p.value)}</p>)}
    </div>
  );
}

/** The goal (dashed), raised and spent lines. `mini`: no axes or legend, for a small tile. */
export function BudgetLineChart({ data, height = 280, mini = false }: { data: ReturnType<typeof budgetSeries>; height?: number; mini?: boolean }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={mini ? { top: 4, right: 2, left: 2, bottom: 2 } : { top: 4, right: 8, left: 0, bottom: 0 }}>
        {!mini && <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.15} />}
        <XAxis dataKey="week" hide={mini} tick={{ fontSize: 11 }} interval="preserveStartEnd" minTickGap={24} />
        <YAxis hide={mini} tick={{ fontSize: 11 }} tickFormatter={(v) => `$${Math.round(v / 1000)}k`} domain={mini ? [0, (max: number) => Math.max(1, max) * 1.08] : [0, "auto"]} />
        {!mini && <Tooltip content={<ChartTooltip />} />}
        {!mini && <Legend wrapperStyle={{ fontSize: 12 }} />}
        <Line type="monotone"  dataKey="goal"   name="Goal"   stroke={GOAL_COLOR}   strokeWidth={mini ? 1.5 : 2} strokeDasharray="6 4" dot={false} isAnimationActive={!mini} />
        <Line type="stepAfter" dataKey="raised" name="Raised" stroke={RAISED_COLOR} strokeWidth={mini ? 2 : 2.5} dot={false} isAnimationActive={!mini} />
        <Line type="stepAfter" dataKey="spent"  name="Spent"  stroke={SPENT_COLOR}  strokeWidth={mini ? 2 : 2.5} dot={false} isAnimationActive={!mini} />
      </LineChart>
    </ResponsiveContainer>
  );
}
