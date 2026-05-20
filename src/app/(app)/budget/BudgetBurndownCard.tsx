"use client";

import { useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
  LineChart, Line, CartesianGrid, ReferenceLine, Cell,
} from "recharts";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/utils";

interface Category { id: string; label: string; allocation: number; }
interface Expense   { date: string; amount: number; categoryId: string | null; }

interface Props {
  totalAllocated: number;
  totalSpent:     number;
  kickoffDate:    string;
  week0Date:      string;
  categories:     Category[];
  expenses:       Expense[];
}

// ─── Recharts custom tooltip ────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-[--color-border] px-3 py-2 text-xs"
      style={{ backgroundColor: "var(--color-surface)", boxShadow: "var(--shadow-md)" }}>
      <p className="font-medium text-[--color-text-primary] mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {formatCurrency(p.value)}
        </p>
      ))}
    </div>
  );
}

// ─── Build cumulative burndown data ─────────────────────────────────────────

function buildBurndownData(
  kickoff: Date, week0: Date, totalAllocated: number, expenses: Expense[]
) {
  // Sample one point per week
  const weeks: { week: string; remaining: number; spent: number }[] = [];
  const sortedExpenses = [...expenses].sort((a, b) => a.date.localeCompare(b.date));
  let cumSpent = 0;
  let ei = 0;

  const cur = new Date(kickoff);
  let weekNum = 0;
  while (cur <= week0) {
    // Accumulate expenses up to this date
    while (ei < sortedExpenses.length && sortedExpenses[ei].date.slice(0, 10) <= cur.toISOString().slice(0, 10)) {
      cumSpent += sortedExpenses[ei].amount;
      ei++;
    }
    if (cur.getDay() === 1 || weekNum === 0) { // Monday or kickoff
      weeks.push({
        week:      `Wk ${weekNum + 1}`,
        remaining: Math.max(0, totalAllocated - cumSpent),
        spent:     cumSpent,
      });
      weekNum++;
    }
    cur.setDate(cur.getDate() + 1);
  }
  // Ensure week0 is always included
  weeks.push({
    week: "Wk 0",
    remaining: Math.max(0, totalAllocated - cumSpent),
    spent: cumSpent,
  });
  return weeks;
}

// ─── Build category breakdown data ─────────────────────────────────────────

function buildCategoryData(categories: Category[], expenses: Expense[]) {
  const spentById: Record<string, number> = {};
  for (const e of expenses) {
    if (e.categoryId) spentById[e.categoryId] = (spentById[e.categoryId] ?? 0) + e.amount;
  }
  return categories
    .filter((c) => c.allocation > 0)
    .map((c) => ({
      name:       c.label.replace(" — ", "\n").replace("Robot Parts ", ""),
      allocated:  c.allocation,
      spent:      spentById[c.id] ?? 0,
      remaining:  Math.max(0, c.allocation - (spentById[c.id] ?? 0)),
    }))
    .sort((a, b) => b.allocated - a.allocated);
}

// ─── Shared colors ───────────────────────────────────────────────────────────

const C_ALLOCATED = "#4F7FE8"; // secondary blue
const C_SPENT     = "#E63946"; // primary red
const C_REMAINING = "#34C77B"; // success green

// ─── Chart panels ────────────────────────────────────────────────────────────

function BurndownLine({ data, totalAllocated, compact = false }: {
  data: ReturnType<typeof buildBurndownData>; totalAllocated: number; compact?: boolean;
}) {
  const h = compact ? 120 : 260;
  return (
    <ResponsiveContainer width="100%" height={h}>
      <LineChart data={data} margin={{ top: 4, right: 8, left: compact ? -20 : 0, bottom: 0 }}>
        {!compact && <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.15} />}
        <XAxis dataKey="week" tick={{ fontSize: 11 }} interval={compact ? 1 : 0} />
        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${Math.round(v / 1000)}k`} />
        <Tooltip content={<ChartTooltip />} />
        {!compact && <Legend wrapperStyle={{ fontSize: 12 }} />}
        <ReferenceLine y={0} stroke="var(--color-border)" />
        <Line
          type="monotone" dataKey="remaining" name="Remaining"
          stroke={C_REMAINING} strokeWidth={2} dot={!compact}
        />
        <Line
          type="monotone" dataKey="spent" name="Spent"
          stroke={C_SPENT} strokeWidth={2} dot={!compact} strokeDasharray={compact ? "4 2" : undefined}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function CategoryBars({ data, compact = false }: {
  data: ReturnType<typeof buildCategoryData>; compact?: boolean;
}) {
  const h = compact ? 120 : 320;
  return (
    <ResponsiveContainer width="100%" height={h}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 8, left: compact ? 60 : 100, bottom: 0 }}>
        {!compact && <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.15} horizontal={false} />}
        <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${Math.round(v / 1000)}k`} />
        <YAxis type="category" dataKey="name" tick={{ fontSize: compact ? 9 : 11 }} width={compact ? 56 : 96} />
        <Tooltip content={<ChartTooltip />} />
        {!compact && <Legend wrapperStyle={{ fontSize: 12 }} />}
        <Bar dataKey="allocated" name="Allocated" fill={C_ALLOCATED} opacity={0.7} radius={[0, 2, 2, 0]} />
        <Bar dataKey="spent"     name="Spent"     fill={C_SPENT}     radius={[0, 2, 2, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export function BudgetBurndownCard({ totalAllocated, totalSpent, kickoffDate, week0Date, categories, expenses }: Props) {
  const [open, setOpen] = useState(false);
  const [tab, setTab]   = useState<"burndown" | "categories">("burndown");

  const burndownData  = useMemo(() => buildBurndownData(new Date(kickoffDate), new Date(week0Date), totalAllocated, expenses), [kickoffDate, week0Date, totalAllocated, expenses]);
  const categoryData  = useMemo(() => buildCategoryData(categories, expenses), [categories, expenses]);

  const pct = totalAllocated > 0 ? Math.round((totalSpent / totalAllocated) * 100) : 0;

  return (
    <>
      {/* Compact card */}
      <div
        className="card cursor-pointer hover:border-[--color-primary]/40 transition-colors group"
        onClick={() => setOpen(true)}
        title="Click to expand"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <h2 className="text-h3 text-[--color-text-primary]">Budget overview</h2>
            {/* Mini KPIs */}
            <div className="hidden sm:flex items-center gap-4 text-small text-[--color-text-secondary]">
              <span><strong className="text-[--color-text-primary]">{formatCurrency(totalSpent)}</strong> spent</span>
              <span><strong className="text-[--color-text-primary]">{pct}%</strong> of budget</span>
              <span style={{ color: totalAllocated - totalSpent < 0 ? "var(--color-danger)" : "var(--color-success)" }}>
                <strong>{formatCurrency(Math.abs(totalAllocated - totalSpent))}</strong>
                {totalAllocated - totalSpent < 0 ? " over" : " remaining"}
              </span>
            </div>
          </div>
          {/* Tab switcher (compact) */}
          <div className="flex items-center gap-2">
            <div className="flex rounded border border-[--color-border] text-xs overflow-hidden">
              {(["burndown", "categories"] as const).map((t) => (
                <button key={t} onClick={(e) => { e.stopPropagation(); setTab(t); }}
                  className={`px-2.5 py-1 transition-colors ${tab === t ? "text-white" : "text-[--color-text-secondary] hover:text-[--color-text-primary] bg-[--color-surface]"}`}
                  style={tab === t ? { backgroundColor: "var(--color-primary)" } : undefined}>
                  {t === "burndown" ? "Burndown" : "By category"}
                </button>
              ))}
            </div>
            <svg className="w-4 h-4 text-[--color-text-secondary] group-hover:text-[--color-primary] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          </div>
        </div>

        {tab === "burndown"
          ? <BurndownLine data={burndownData} totalAllocated={totalAllocated} compact />
          : <CategoryBars data={categoryData} compact />}

        <p className="text-small text-[--color-text-disabled] text-right mt-1">Click to expand</p>
      </div>

      {/* Expanded modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title="Budget overview" className="sm:max-w-3xl">
          <div className="space-y-4">
            {/* KPI summary row */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Total allocated", value: formatCurrency(totalAllocated), color: C_ALLOCATED },
                { label: "Total spent",     value: formatCurrency(totalSpent),     color: C_SPENT },
                { label: "Remaining",       value: formatCurrency(Math.max(0, totalAllocated - totalSpent)), color: C_REMAINING },
              ].map((s) => (
                <div key={s.label} className="rounded-md bg-[--color-surface-overlay] px-3 py-2.5 text-center">
                  <p className="text-h2 font-bold" style={{ color: s.color }}>{s.value}</p>
                  <p className="text-label text-[--color-text-secondary]">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Tabs */}
            <div className="flex border-b border-[--color-border] gap-4">
              {(["burndown", "categories"] as const).map((t) => (
                <button key={t} onClick={() => setTab(t)}
                  className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
                    tab === t
                      ? "border-[--color-primary] text-[--color-primary]"
                      : "border-transparent text-[--color-text-secondary] hover:text-[--color-text-primary]"
                  }`}>
                  {t === "burndown" ? "Cumulative burndown" : "By category"}
                </button>
              ))}
            </div>

            {tab === "burndown" && (
              <div>
                <p className="text-small text-[--color-text-secondary] mb-3">
                  Cumulative spend (red) vs. remaining budget (green) over the build season.
                </p>
                <BurndownLine data={burndownData} totalAllocated={totalAllocated} />
              </div>
            )}

            {tab === "categories" && (
              <div>
                <p className="text-small text-[--color-text-secondary] mb-3">
                  Allocated (blue) vs. spent (red) per budget category.
                </p>
                <CategoryBars data={categoryData} />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
