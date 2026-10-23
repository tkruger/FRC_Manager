"use client";

import Link from "next/link";
import { useMemo } from "react";
import { formatCurrency } from "@/lib/utils";
import { BudgetLineChart, budgetSeries, GOAL_COLOR, RAISED_COLOR, SPENT_COLOR, type MoneyPoint } from "./BudgetLineChart";

/** Whole dollars for a small tile ("$6,500") */
const dollars = (v: number) => formatCurrency(Math.round(v)).replace(/\.00$/, "");

/**
 * Home page tile: the budget's goal, raised and spent as a small line chart up to today,
 * with the numbers underneath. Opens the Budget page.
 */
export function BudgetTile({ goal, raised, spent, kickoffDate, endDate, expenses, raises }: {
  goal: number; raised: number; spent: number; kickoffDate: string; endDate: string; expenses: MoneyPoint[]; raises: MoneyPoint[];
}) {
  const data = useMemo(
    () => budgetSeries(kickoffDate, endDate, goal, expenses, raises, new Date().toISOString()),
    [kickoffDate, endDate, goal, expenses, raises],
  );
  const over = spent > raised && raised > 0;
  return (
    <Link href="/budget" className="card group no-underline block" style={{ borderLeftWidth: "3px", borderLeftColor: RAISED_COLOR }}>
      <p className="text-small text-(--color-text-secondary) group-hover:text-(--color-text-primary) transition-colors">Budget</p>
      <div className="mt-1 -mx-1">
        <BudgetLineChart data={data} height={44} mini />
      </div>
      {/* One per line, so they fit a phone's half-width tile */}
      <p className="text-small mt-1 truncate" style={{ color: RAISED_COLOR }}>{dollars(raised)} raised</p>
      <p className="text-small truncate" style={{ color: SPENT_COLOR }}>{dollars(spent)} spent</p>
      <p className={`text-small truncate ${over ? "text-(--color-warning)" : "text-(--color-text-secondary)"}`}>
        {over ? "Spent more than raised" : <>of <span style={{ color: GOAL_COLOR }}>{dollars(goal)}</span> goal</>}
      </p>
    </Link>
  );
}
