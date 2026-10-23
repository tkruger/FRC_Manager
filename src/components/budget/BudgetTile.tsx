"use client";

import Link from "next/link";
import { useMemo } from "react";
import { formatCurrency } from "@/lib/utils";
import { BudgetLineChart, budgetSeries, GOAL_COLOR, RAISED_COLOR, SPENT_COLOR, type MoneyPoint } from "./BudgetLineChart";

/** Whole dollars for a small tile ("$6,500") */
const dollars = (v: number) => formatCurrency(Math.round(v)).replace(/\.00$/, "");

/**
 * Home page tile: the budget's goal, raised and spent as a line chart up to today, with the
 * numbers as small labels inside it (the goal on its dashed line, raised and spent beneath)
 * so the chart gets the room. Opens the Budget page.
 */
export function BudgetTile({ goal, raised, spent, kickoffDate, endDate, expenses, raises }: {
  goal: number; raised: number; spent: number; kickoffDate: string; endDate: string; expenses: MoneyPoint[]; raises: MoneyPoint[];
}) {
  const data = useMemo(
    () => budgetSeries(kickoffDate, endDate, goal, expenses, raises, new Date().toISOString()),
    [kickoffDate, endDate, goal, expenses, raises],
  );
  const over = spent > raised && raised > 0;
  // Small labels with a soft backing so they stay readable over the lines
  const tag = "rounded px-1 text-[11px] leading-4 font-medium bg-(--color-surface)/70 backdrop-blur-[1px]";

  return (
    <Link href="/budget" className="card group no-underline block" style={{ borderLeftWidth: "3px", borderLeftColor: RAISED_COLOR }}
      aria-label={`Budget: ${dollars(raised)} raised, ${dollars(spent)} spent, of a ${dollars(goal)} goal`}>
      <p className="text-small text-(--color-text-secondary) group-hover:text-(--color-text-primary) transition-colors">Budget</p>
      <div className="relative mt-1 -mx-1">
        <div className="pt-4">
          <BudgetLineChart data={data} height={82} mini />
        </div>
        {/* The goal, on its dashed line */}
        <span className={`absolute right-0 top-0 ${tag}`} style={{ color: GOAL_COLOR }}>{dollars(goal)} goal</span>
        {/* Raised and spent, in the space under the goal line */}
        <div className="absolute left-0 top-9 flex flex-col items-start gap-0.5">
          <span className={tag} style={{ color: RAISED_COLOR }}>{dollars(raised)} raised</span>
          <span className={tag} style={{ color: SPENT_COLOR }}>{dollars(spent)} spent</span>
          {over && <span className={`${tag} text-(--color-warning)`}>Spent more than raised</span>}
        </div>
      </div>
    </Link>
  );
}
