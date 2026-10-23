// The three numbers a team watches: the budget goal, how much has been raised, and how much
// has been spent. Shared by the home page and the Budget page so they always agree.

import { prisma } from "@/lib/prisma";
import type { FundingStatus } from "@/generated/prisma";

/** What a funding source has actually brought in so far */
export function raisedFrom(f: { amount: number; status: FundingStatus; receivedAmount: number | null }): number {
  if (f.status === "RECEIVED") return f.amount;
  if (f.status === "PARTIAL") return Math.min(f.amount, Math.max(0, f.receivedAmount ?? 0));
  return 0;
}

export interface BudgetTotals {
  /** What the team plans to spend: the category allocations added up */
  goal: number;
  /** Money in hand — received funding, including the team account */
  raised: number;
  /** Of that, from the team's own account */
  fromTeamAccount: number;
  /** Promised but not in yet */
  pledged: number;
  /** Spent, including orders placed but not yet received */
  spent: number;
  /** Of that, on order (committed, not yet paid out) */
  committed: number;
}

export function budgetTotals(budget: {
  categories: { allocation: number }[];
  fundingSources: { type: string; amount: number; status: FundingStatus; receivedAmount: number | null }[];
  expenses: { amount: number; isCommitment: boolean }[];
}): BudgetTotals {
  const raised = budget.fundingSources.reduce((s, f) => s + raisedFrom(f), 0);
  return {
    goal:            budget.categories.reduce((s, c) => s + c.allocation, 0),
    raised,
    fromTeamAccount: budget.fundingSources.filter((f) => f.type === "TEAM_ACCOUNT").reduce((s, f) => s + raisedFrom(f), 0),
    pledged:         budget.fundingSources.reduce((s, f) => s + f.amount, 0) - raised,
    spent:           budget.expenses.reduce((s, e) => s + e.amount, 0),
    committed:       budget.expenses.filter((e) => e.isCommitment).reduce((s, e) => s + e.amount, 0),
  };
}

/** The active season's totals, or null when it has no budget yet */
export async function seasonBudgetTotals(seasonId: string): Promise<BudgetTotals | null> {
  const budget = await prisma.budget.findUnique({
    where:  { seasonId },
    select: {
      categories:     { select: { allocation: true } },
      fundingSources: { select: { type: true, amount: true, status: true, receivedAmount: true } },
      expenses:       { select: { amount: true, isCommitment: true } },
    },
  });
  return budget ? budgetTotals(budget) : null;
}
