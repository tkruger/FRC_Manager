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
import { FUNDING_TYPE_LABELS } from "@/lib/funding";
import { budgetTotals, raisedFrom } from "@/lib/budget-summary";
import { LogExpenseDialog } from "./LogExpenseDialog";
import { BudgetBurndownCard } from "./BudgetBurndownCard";
import { PageHeader } from "@/components/PageHeader";

const BUDGET_ROLES = ["HEAD_MENTOR", "TREASURER"];

export default async function BudgetDashboard() {
  const session = await auth();
  if (!session?.user?.teamId) redirect("/dashboard");

  const canEdit = session.user.roles.some((r) => BUDGET_ROLES.includes(r));

  const activeSeason = await prisma.season.findFirst({
    where: { teamId: session.user.teamId, isActive: true },
  });

  if (!activeSeason) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-h1 text-(--color-text-primary) mb-4">Budget</h1>
        <div className="card">
          <p className="text-body text-(--color-text-secondary)">
            No active season. <Link href="/settings/season" className="text-(--color-secondary) hover:underline">Set up a season</Link> first.
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
      expenses: { orderBy: { date: "asc" } }, // all expenses, ascending for burndown
    },
  });

  if (!budget) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <PageHeader title="Budget" help="budget" />
        <div className="card text-center py-12">
          <p className="text-body text-(--color-text-secondary) mb-4">No budget configured for {activeSeason.name}.</p>
          {canEdit
            ? <Link href="/budget/setup"><Button>Set up budget</Button></Link>
            : <p className="text-small text-(--color-text-disabled)">A Treasurer or Head Mentor can set up the budget.</p>}
        </div>
      </div>
    );
  }

  // The three numbers: goal (planned spend), raised (money in, incl. the team account), spent
  const totals = budgetTotals(budget);
  const { goal, raised, spent } = totals;
  const totalAllocated = goal;
  const totalSpent = spent;

  // Spend with no category (orders placed before categories were required, or expenses
  // logged without one) — and the orders to fix
  const uncategorized = budget.expenses.filter((e) => !e.categoryId);
  const uncategorizedTotal = uncategorized.reduce((s, e) => s + e.amount, 0);
  const uncategorizedOrderIds = [...new Set(uncategorized.map((e) => e.purchaseRequestId).filter((id): id is string => !!id))];
  const ordersToFix = uncategorizedOrderIds.length
    ? await prisma.purchaseRequest.findMany({ where: { id: { in: uncategorizedOrderIds } }, select: { id: true, title: true }, orderBy: { submittedAt: "desc" }, take: 10 })
    : [];
  const spentIn = (categoryId: string) => budget.expenses.filter((e) => e.categoryId === categoryId).reduce((s, e) => s + e.amount, 0);

  // Over the goal, or spending money that hasn't been raised (once funding is tracked)
  const tracksFunding = budget.fundingSources.length > 0;
  const budgetHealth: "success" | "warning" | "danger" =
    totalSpent > totalAllocated || (tracksFunding && spent > raised) ? "danger"
    : totalSpent > totalAllocated * 0.85 || (tracksFunding && spent > raised * 0.85) ? "warning"
    : "success";
  const healthLabel = budgetHealth === "success" ? "On track"
    : tracksFunding && spent > raised ? "Spent more than raised"
    : budgetHealth === "warning" ? (tracksFunding && spent > raised * 0.85 ? "Raised money running low" : "Close to the goal")
    : "Over the goal";

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <PageHeader
        title="Budget"
        help="budget"
        subtitle={activeSeason.name}
        actions={<>
          {!canEdit && (
            <span className="text-small text-(--color-text-secondary) italic">Read-only view</span>
          )}
          {canEdit && (
            <Link href="/budget/setup"><Button variant="outline" size="sm">Edit budget</Button></Link>
          )}
          <Link href="/budget/bom"><Button variant="outline" size="sm">Robot BOM</Button></Link>
          {canEdit && (
            <LogExpenseDialog budgetId={budget.id} categories={budget.categories} />
          )}
        </>}
      />

      {/* Goal, raised and spent over the season */}
      <BudgetBurndownCard
        badge={<Badge variant={budgetHealth}>{healthLabel}</Badge>}
        goal={goal}
        raised={raised}
        spent={spent}
        raises={budget.fundingSources
          .map((f) => ({ date: (f.receivedDate ?? f.createdAt).toISOString(), amount: raisedFrom(f) }))
          .filter((r) => r.amount > 0)}
        kickoffDate={activeSeason.kickoffDate.toISOString()}
        endDate={activeSeason.endDate.toISOString()}
        expenses={budget.expenses.map((e) => ({ date: e.date.toISOString(), amount: e.amount }))}
      />

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Budget goal", value: formatCurrency(goal), sub: "planned across categories" },
          { label: "Raised", value: formatCurrency(raised), sub: totals.pledged > 0 ? `+ ${formatCurrency(totals.pledged)} pledged` : goal > 0 ? `${Math.round((raised / goal) * 100)}% of goal` : "money in hand" },
          { label: "Spent", value: formatCurrency(spent), sub: goal > 0 ? `${Math.round((spent / goal) * 100)}% of goal` : "so far" },
          { label: "Left to spend", value: formatCurrency(raised - spent), sub: raised - spent < 0 ? "SPENT MORE THAN RAISED" : "raised, not yet spent" },
        ].map((s) => (
          <div key={s.label} className="card">
            <p className="text-small text-(--color-text-secondary)">{s.label}</p>
            <p className="text-h2 text-(--color-text-primary) mt-1">{s.value}</p>
            <p className="text-small text-(--color-text-secondary) mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Category breakdown */}
      <div>
        <h2 className="text-h2 text-(--color-text-primary) mb-3">By category</h2>
        <div className="card space-y-4">
          {budget.categories.filter((c) => c.allocation > 0).map((cat) => {
            const catSpent = spentIn(cat.id);
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
          {/* Spend in categories with nothing allocated (e.g. Other) */}
          {budget.categories.filter((c) => c.allocation <= 0 && spentIn(c.id) > 0).map((cat) => (
            <div key={cat.id} className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
              <span className="text-(--color-text-primary)">{cat.label}</span>
              <span className="text-(--color-text-secondary)">
                {formatCurrency(spentIn(cat.id))} <span className="text-(--color-warning)">· nothing allocated</span>
              </span>
            </div>
          ))}
          {uncategorizedTotal > 0 && (
            <div className="rounded-md bg-(--color-warning)/10 border border-(--color-warning)/20 px-3 py-2.5 space-y-1.5">
              <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                <span className="font-medium text-(--color-text-primary)">Uncategorized</span>
                <span className="text-(--color-text-primary)">{formatCurrency(uncategorizedTotal)}</span>
              </div>
              {ordersToFix.length > 0 && (
                <p className="text-small text-(--color-text-secondary)">
                  Set a budget category on {ordersToFix.length === 1 ? "this order" : "these orders"} to count {ordersToFix.length === 1 ? "it" : "them"} above:{" "}
                  {ordersToFix.map((o, i) => (
                    <span key={o.id}>{i > 0 && ", "}<Link href={`/procurement/requests/${o.id}`} className="text-(--color-secondary) hover:underline">{o.title}</Link></span>
                  ))}
                  {uncategorizedOrderIds.length > ordersToFix.length && ` and ${uncategorizedOrderIds.length - ordersToFix.length} more`}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Funding sources + Recent expenses side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Funding sources */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-h2 text-(--color-text-primary)">Funding sources</h2>
            {canEdit && <AddFundingDialog budgetId={budget.id} />}
          </div>
          <div className="card space-y-3">
            {budget.fundingSources.length === 0 ? (
              <p className="text-small text-(--color-text-secondary)">No funding sources added.</p>
            ) : budget.fundingSources.map((f) => (
              <div key={f.id} className="flex items-center justify-between py-2 border-b border-(--color-border) last:border-0">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-(--color-text-primary)">{f.name}</p>
                  <p className="text-small text-(--color-text-secondary)">
                    {FUNDING_TYPE_LABELS[f.type] ?? f.type.replace(/_/g, " ")}
                    {f.receivedDate && f.status !== "PLEDGED" && ` · ${f.receivedDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}`}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <p className="text-sm font-medium text-(--color-text-primary)">
                      {f.status === "PARTIAL" ? <>{formatCurrency(raisedFrom(f))} <span className="text-(--color-text-secondary) font-normal">of {formatCurrency(f.amount)}</span></> : formatCurrency(f.amount)}
                    </p>
                    <Badge variant={f.status === "RECEIVED" ? "success" : f.status === "PARTIAL" ? "warning" : "neutral"}>
                      {f.status === "RECEIVED" ? "Received" : f.status === "PARTIAL" ? "Partly received" : "Pledged"}
                    </Badge>
                  </div>
                  {canEdit && (
                    <AddFundingDialog budgetId={budget.id} source={{
                      id: f.id, name: f.name, type: f.type, amount: f.amount, status: f.status,
                      receivedAmount: f.receivedAmount, receivedDate: f.receivedDate?.toISOString() ?? null, notes: f.notes,
                    }} />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent expenses */}
        <div>
          <h2 className="text-h2 text-(--color-text-primary) mb-3">Recent expenses</h2>
          <div className="card space-y-3">
            {budget.expenses.length === 0 ? (
              <p className="text-small text-(--color-text-secondary)">No expenses logged.</p>
            ) : budget.expenses.slice(0, 8).map((e) => (
              <div key={e.id} className="flex items-center justify-between py-2 border-b border-(--color-border) last:border-0">
                <div>
                  <p className="text-sm font-medium text-(--color-text-primary)">{e.description}</p>
                  <p className="text-small text-(--color-text-secondary)">
                    {e.vendor ? `${e.vendor} · ` : ""}{formatDate(e.date)}
                    {e.isCommitment && <span className="ml-1.5 badge badge-info">Committed — on order</span>}
                  </p>
                </div>
                <p className="text-sm font-medium text-(--color-text-primary) shrink-0 ml-4">{formatCurrency(e.amount)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

