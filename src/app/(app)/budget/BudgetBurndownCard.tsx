"use client";

import { useState, useMemo } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/utils";
import { BudgetLineChart, budgetSeries, GOAL_COLOR, RAISED_COLOR, SPENT_COLOR, type MoneyPoint } from "@/components/budget/BudgetLineChart";

interface Props {
  /** What the team plans to spend (category allocations added up) */
  goal:        number;
  raised:      number;
  spent:       number;
  kickoffDate: string;
  endDate:     string;
  /** Money spent, and money that came in, by date */
  expenses:    MoneyPoint[];
  raises:      MoneyPoint[];
  /** e.g. an "On track" badge */
  badge?:      React.ReactNode;
}

/** The Budget page chart: goal, raised and spent over the season. Click for a bigger view. */
export function BudgetBurndownCard({ goal, raised, spent, kickoffDate, endDate, expenses, raises, badge }: Props) {
  const [open, setOpen] = useState(false);
  const data = useMemo(() => budgetSeries(kickoffDate, endDate, goal, expenses, raises), [kickoffDate, endDate, goal, expenses, raises]);

  return (
    <>
      <div className="card cursor-pointer hover:border-(--color-primary)/40 transition-colors group" onClick={() => setOpen(true)} title="Click to expand">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="text-h3 text-(--color-text-primary)">Goal, raised and spent</h2>
          <div className="flex items-center gap-2">
            {badge}
            <svg className="w-4 h-4 text-(--color-text-secondary) group-hover:text-(--color-primary) transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          </div>
        </div>
        <BudgetLineChart data={data} height={220} />
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
            <p className="text-small text-(--color-text-secondary)">
              The goal (dashed), money raised so far and money spent so far (including orders not yet received), week by week.
            </p>
            <BudgetLineChart data={data} height={320} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
