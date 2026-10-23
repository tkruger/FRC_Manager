"use client";

import { useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
  LineChart, Line, CartesianGrid,
} from "recharts";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/utils";
import { GOAL_COLOR, RAISED_COLOR, SPENT_COLOR } from "@/components/budget/BudgetGauge";

interface Category { id: string; label: string; allocation: number; }
interface Expense   { date: string; amount: number; categoryId: string | null; }
/** Money that came in, and when */
interface Raise     { date: string; amount: number; }

interface Props {
  /** What the team plans to spend (category allocations added up) */
  goal:        number;
  raised:      number;
  spent:       number;
  kickoffDate: string;
  endDate:     string;
  categories:  Category[];
  expenses:    Expense[];
  raises:      Raise[];
}

// ─── Recharts custom tooltip ────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-(--color-border) px-3 py-2 text-xs"
      style={{ backgroundColor: "var(--color-surface)", boxShadow: "var(--shadow-md)" }}>
      <p className="font-medium text-(--color-text-primary) mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {formatCurrency(p.value)}
        </p>
      ))}
    </div>
  );
}

// ─── Goal, raised and spent, week by week ───────────────────────────────────

const DAY = 86_400_000;
const label = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

function buildProgressData(kickoff: Date, end: Date, goal: number, expenses: Expense[], raises: Raise[]) {
  // From the earliest of kickoff and the first money in or out, to the season's end
  const firsts = [...expenses.map((e) => e.date), ...raises.map((r) => r.date)].map((d) => new Date(d).getTime());
  const start = Math.min(kickoff.getTime(), ...firsts);
  const sum = (list: { date: string; amount: number }[], upTo: number) =>
    list.reduce((s, x) => (new Date(x.date).getTime() <= upTo ? s + x.amount : s), 0);

  const points: { week: string; goal: number; raised: number; spent: number }[] = [];
  for (let t = start; t < end.getTime() + 7 * DAY; t += 7 * DAY) {
    const at = Math.min(t, end.getTime());
    points.push({ week: label(new Date(at)), goal, raised: sum(raises, at), spent: sum(expenses, at) });
    if (at === end.getTime()) break;
  }
  return points;
}

// ─── Category breakdown ─────────────────────────────────────────────────────

function buildCategoryData(categories: Category[], expenses: Expense[]) {
  const spentById: Record<string, number> = {};
  for (const e of expenses) {
    if (e.categoryId) spentById[e.categoryId] = (spentById[e.categoryId] ?? 0) + e.amount;
  }
  return categories
    .filter((c) => c.allocation > 0)
    .map((c) => ({
      name:      c.label.replace(" — ", "\n").replace("Robot Parts ", ""),
      allocated: c.allocation,
      spent:     spentById[c.id] ?? 0,
    }))
    .sort((a, b) => b.allocated - a.allocated);
}

// ─── Chart panels ────────────────────────────────────────────────────────────

function ProgressLines({ data, compact = false }: { data: ReturnType<typeof buildProgressData>; compact?: boolean }) {
  return (
    <ResponsiveContainer width="100%" height={compact ? 150 : 280}>
      <LineChart data={data} margin={{ top: 4, right: 8, left: compact ? -20 : 0, bottom: 0 }}>
        {!compact && <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.15} />}
        <XAxis dataKey="week" tick={{ fontSize: 11 }} interval="preserveStartEnd" minTickGap={24} />
        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${Math.round(v / 1000)}k`} />
        <Tooltip content={<ChartTooltip />} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line type="monotone" dataKey="goal"   name="Goal"   stroke={GOAL_COLOR}   strokeWidth={2} strokeDasharray="6 4" dot={false} />
        <Line type="stepAfter" dataKey="raised" name="Raised" stroke={RAISED_COLOR} strokeWidth={2.5} dot={false} />
        <Line type="stepAfter" dataKey="spent"  name="Spent"  stroke={SPENT_COLOR}  strokeWidth={2.5} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function CategoryBars({ data, compact = false }: { data: ReturnType<typeof buildCategoryData>; compact?: boolean }) {
  return (
    <ResponsiveContainer width="100%" height={compact ? 150 : 320}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 8, left: compact ? 60 : 100, bottom: 0 }}>
        {!compact && <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.15} horizontal={false} />}
        <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${Math.round(v / 1000)}k`} />
        <YAxis type="category" dataKey="name" tick={{ fontSize: compact ? 9 : 11 }} width={compact ? 56 : 96} />
        <Tooltip content={<ChartTooltip />} />
        {!compact && <Legend wrapperStyle={{ fontSize: 12 }} />}
        <Bar dataKey="allocated" name="Planned" fill={GOAL_COLOR} opacity={0.7} radius={[0, 2, 2, 0]} />
        <Bar dataKey="spent"     name="Spent"   fill={SPENT_COLOR} radius={[0, 2, 2, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

/** The Budget page chart: goal, raised and spent over the season — or spend by category */
export function BudgetBurndownCard({ goal, raised, spent, kickoffDate, endDate, categories, expenses, raises }: Props) {
  const [open, setOpen] = useState(false);
  const [tab, setTab]   = useState<"season" | "categories">("season");

  const progressData = useMemo(() => buildProgressData(new Date(kickoffDate), new Date(endDate), goal, expenses, raises), [kickoffDate, endDate, goal, expenses, raises]);
  const categoryData = useMemo(() => buildCategoryData(categories, expenses), [categories, expenses]);
  const tabs = [["season", "Over the season"], ["categories", "By category"]] as const;

  return (
    <>
      <div className="card cursor-pointer hover:border-(--color-primary)/40 transition-colors group" onClick={() => setOpen(true)} title="Click to expand">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="text-h3 text-(--color-text-primary)">Goal, raised and spent</h2>
          <div className="flex items-center gap-2">
            <div className="flex rounded border border-(--color-border) text-xs overflow-hidden">
              {tabs.map(([t, name]) => (
                <button key={t} onClick={(e) => { e.stopPropagation(); setTab(t); }}
                  className={`px-2.5 py-1 transition-colors ${tab === t ? "text-white" : "text-(--color-text-secondary) hover:text-(--color-text-primary) bg-(--color-surface)"}`}
                  style={tab === t ? { backgroundColor: "var(--color-primary)" } : undefined}>
                  {name}
                </button>
              ))}
            </div>
            <svg className="w-4 h-4 text-(--color-text-secondary) group-hover:text-(--color-primary) transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          </div>
        </div>
        {tab === "season" ? <ProgressLines data={progressData} compact /> : <CategoryBars data={categoryData} compact />}
        <p className="text-small text-(--color-text-disabled) text-right mt-1">Click to expand</p>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title="Goal, raised and spent" className="sm:max-w-3xl">
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Goal",   value: goal,   color: GOAL_COLOR },
                { label: "Raised", value: raised, color: RAISED_COLOR },
                { label: "Spent",  value: spent,  color: SPENT_COLOR },
              ].map((s) => (
                <div key={s.label} className="rounded-md bg-(--color-surface-overlay) px-3 py-2.5 text-center">
                  <p className="text-h2 font-bold" style={{ color: s.color }}>{formatCurrency(s.value)}</p>
                  <p className="text-label text-(--color-text-secondary)">{s.label}</p>
                </div>
              ))}
            </div>
            <div className="flex border-b border-(--color-border) gap-4">
              {tabs.map(([t, name]) => (
                <button key={t} onClick={() => setTab(t)}
                  className={`pb-2 text-sm font-medium border-b-2 transition-colors ${tab === t ? "border-(--color-primary) text-(--color-primary)" : "border-transparent text-(--color-text-secondary) hover:text-(--color-text-primary)"}`}>
                  {name}
                </button>
              ))}
            </div>
            {tab === "season" ? (
              <div>
                <p className="text-small text-(--color-text-secondary) mb-3">
                  The goal (dashed), money raised so far and money spent so far (including orders not yet received), week by week.
                </p>
                <ProgressLines data={progressData} />
              </div>
            ) : (
              <div>
                <p className="text-small text-(--color-text-secondary) mb-3">Planned (blue) vs. spent (red) per budget category.</p>
                <CategoryBars data={categoryData} />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
