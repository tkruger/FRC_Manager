import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress";
import { Table, TableHead, TableBody, Th, Td, Tr } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/utils";
import { AddFundingDialog } from "./AddFundingDialog";
import { LogExpenseDialog } from "./LogExpenseDialog";

export default async function BudgetDashboard() {
  const session = await auth();
  if (!session?.user?.teamId) redirect("/dashboard");

  const activeSeason = await prisma.season.findFirst({
    where: { teamId: session.user.teamId, isActive: true },
  });

  if (!activeSeason) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-h1 text-[--color-text-primary] mb-4">Budget</h1>
        <div className="card">
          <p className="text-body text-[--color-text-secondary]">
            No active season. <Link href="/settings/season" className="text-[--color-secondary] hover:underline">Set up a season</Link> first.
          </p>
        </div>
      </div>
    );
  }

  const budget = await prisma.budget.findUnique({
    where: { seasonId: activeSeason.id },
    include: {
      categories: { orderBy: { type: "asc" } },
      fundingSources: { orderBy: { createdAt: "desc" } },
      expenses: { orderBy: { date: "desc" }, take: 20 },
    },
  });

  if (!budget) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <h1 className="text-h1 text-[--color-text-primary]">Budget</h1>
        <div className="card text-center py-12">
          <p className="text-body text-[--color-text-secondary] mb-4">No budget configured for {activeSeason.name}.</p>
          <Link href="/budget/setup"><Button>Set up budget</Button></Link>
        </div>
      </div>
    );
  }

  // Totals
  const totalFunding = budget.fundingSources.reduce((s, f) => s + f.amount, 0);
  const receivedFunding = budget.fundingSources.filter((f) => f.status === "RECEIVED").reduce((s, f) => s + f.amount, 0);
  const totalAllocated = budget.categories.reduce((s, c) => s + c.allocation, 0);
  const totalSpent = budget.expenses.reduce((s, e) => s + e.amount, 0);
  const remaining = totalAllocated - totalSpent;

  const budgetHealth: "success" | "warning" | "danger" =
    totalSpent > totalAllocated ? "danger"
    : totalSpent > totalAllocated * 0.85 ? "warning"
    : "success";

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h1 text-[--color-text-primary]">Budget</h1>
          <p className="text-body text-[--color-text-secondary] mt-1">{activeSeason.name}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/budget/setup"><Button variant="outline" size="sm">Edit budget</Button></Link>
          <Link href="/budget/bom"><Button variant="outline" size="sm">Robot BOM</Button></Link>
          <LogExpenseDialog budgetId={budget.id} categories={budget.categories} />
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total budget", value: formatCurrency(totalAllocated), sub: "allocated across categories" },
          { label: "Total spent", value: formatCurrency(totalSpent), sub: `${Math.round((totalSpent / totalAllocated) * 100)}% of budget` },
          { label: "Remaining", value: formatCurrency(remaining), sub: remaining < 0 ? "OVER BUDGET" : "available" },
          { label: "Funding received", value: formatCurrency(receivedFunding), sub: `of ${formatCurrency(totalFunding)} pledged` },
        ].map((s) => (
          <div key={s.label} className="card">
            <p className="text-small text-[--color-text-secondary]">{s.label}</p>
            <p className="text-h2 text-[--color-text-primary] mt-1">{s.value}</p>
            <p className="text-small text-[--color-text-secondary] mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Overall progress */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-h3 text-[--color-text-primary]">Overall spending</h2>
          <Badge variant={budgetHealth}>
            {budgetHealth === "success" ? "On track" : budgetHealth === "warning" ? "At risk" : "Over budget"}
          </Badge>
        </div>
        <ProgressBar
          value={totalSpent}
          max={totalAllocated}
          sublabel={`${formatCurrency(totalSpent)} of ${formatCurrency(totalAllocated)}`}
          warnAt={85}
          dangerAt={100}
        />
      </div>

      {/* Category breakdown */}
      <div>
        <h2 className="text-h2 text-[--color-text-primary] mb-3">By category</h2>
        <div className="card space-y-4">
          {budget.categories.filter((c) => c.allocation > 0).map((cat) => {
            const catSpent = budget.expenses
              .filter((e) => e.categoryId === cat.id)
              .reduce((s, e) => s + e.amount, 0);
            return (
              <div key={cat.id}>
                <ProgressBar
                  value={catSpent}
                  max={cat.allocation}
                  label={cat.label}
                  sublabel={`${formatCurrency(catSpent)} / ${formatCurrency(cat.allocation)}`}
                  warnAt={80}
                  dangerAt={100}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Funding sources + Recent expenses side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Funding sources */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-h2 text-[--color-text-primary]">Funding sources</h2>
            <AddFundingDialog budgetId={budget.id} />
          </div>
          <div className="card space-y-3">
            {budget.fundingSources.length === 0 ? (
              <p className="text-small text-[--color-text-secondary]">No funding sources added.</p>
            ) : budget.fundingSources.map((f) => (
              <div key={f.id} className="flex items-center justify-between py-2 border-b border-[--color-border] last:border-0">
                <div>
                  <p className="text-sm font-medium text-[--color-text-primary]">{f.name}</p>
                  <p className="text-small text-[--color-text-secondary]">{f.type.replace(/_/g, " ")}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-[--color-text-primary]">{formatCurrency(f.amount)}</p>
                  <Badge variant={f.status === "RECEIVED" ? "success" : f.status === "PARTIAL" ? "warning" : "neutral"}>
                    {f.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent expenses */}
        <div>
          <h2 className="text-h2 text-[--color-text-primary] mb-3">Recent expenses</h2>
          <div className="card space-y-3">
            {budget.expenses.length === 0 ? (
              <p className="text-small text-[--color-text-secondary]">No expenses logged.</p>
            ) : budget.expenses.slice(0, 8).map((e) => (
              <div key={e.id} className="flex items-center justify-between py-2 border-b border-[--color-border] last:border-0">
                <div>
                  <p className="text-sm font-medium text-[--color-text-primary]">{e.description}</p>
                  <p className="text-small text-[--color-text-secondary]">{e.vendor ? `${e.vendor} · ` : ""}{formatDate(e.date)}</p>
                </div>
                <p className="text-sm font-medium text-[--color-text-primary] shrink-0 ml-4">{formatCurrency(e.amount)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
