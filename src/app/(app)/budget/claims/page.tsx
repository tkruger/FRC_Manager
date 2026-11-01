import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { canReviewClaims, claimStatusInfo } from "@/lib/expense-claims";

// Expense claims: your own, and for Treasurers and Head Mentors the queue — waiting for review,
// approved refunds waiting to be paid, and everything recent.

const DAY = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

type Row = {
  id: string; expenseDate: Date; amount: number; description: string; vendor: string | null; reimbursement: boolean;
  status: "SUBMITTED" | "APPROVED" | "DENIED" | "PAID" | "WITHDRAWN"; createdAt: Date;
  submittedBy: { name: string } | null; _count: { receipts: number };
};

const select = {
  id: true, expenseDate: true, amount: true, description: true, vendor: true, reimbursement: true, status: true, createdAt: true,
  submittedBy: { select: { name: true } }, _count: { select: { receipts: true } },
} as const;

function ClaimList({ rows, showWho, empty }: { rows: Row[]; showWho: boolean; empty: string }) {
  if (rows.length === 0) return <div className="card py-6 text-center text-body text-(--color-text-secondary)">{empty}</div>;
  return (
    <ul className="card p-0 divide-y divide-(--color-border) overflow-hidden">
      {rows.map((c) => {
        const info = claimStatusInfo(c.status, c.reimbursement);
        return (
          <li key={c.id}>
            <Link href={`/budget/claims/${c.id}`} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 px-4 py-3 hover:bg-(--color-surface-overlay)">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-(--color-text-primary)">{c.description}</p>
                <p className="text-small text-(--color-text-secondary)">
                  {DAY(c.expenseDate)}{c.vendor ? ` · ${c.vendor}` : ""}{showWho && c.submittedBy ? ` · ${c.submittedBy.name}` : ""}
                  {` · ${c._count.receipts} receipt${c._count.receipts === 1 ? "" : "s"}`}
                </p>
              </div>
              <span className="flex flex-wrap items-center gap-2">
                {c.reimbursement && <Badge variant="info">Refund</Badge>}
                <Badge variant={info.badge}>{info.label}</Badge>
                <span className="w-24 text-right text-sm font-semibold tabular-nums text-(--color-text-primary)">{formatCurrency(c.amount)}</span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export default async function ClaimsPage() {
  const session = await auth();
  if (!session?.user?.teamId) redirect("/dashboard");
  const teamId = session.user.teamId;
  const reviewer = canReviewClaims(session.user.roles);

  const [mine, toReview, toPay, recent] = await Promise.all([
    prisma.expenseClaim.findMany({ where: { teamId, submittedById: session.user.id }, orderBy: { createdAt: "desc" }, take: 50, select }),
    reviewer ? prisma.expenseClaim.findMany({ where: { teamId, status: "SUBMITTED" }, orderBy: { createdAt: "asc" }, select }) : [],
    reviewer ? prisma.expenseClaim.findMany({ where: { teamId, status: "APPROVED", reimbursement: true }, orderBy: { reviewedAt: "asc" }, select }) : [],
    reviewer ? prisma.expenseClaim.findMany({ where: { teamId, status: { in: ["APPROVED", "DENIED", "PAID", "WITHDRAWN"] }, NOT: { status: "APPROVED", reimbursement: true } }, orderBy: { updatedAt: "desc" }, take: 30, select }) : [],
  ]);
  const owed = toPay.reduce((s, c) => s + c.amount, 0);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <PageHeader
        title="Expenses & refunds"
        help="expenses"
        subtitle={reviewer ? "Review what people spent for the team, and pay back refunds" : "What you've spent for the team, and refunds you've asked for"}
        actions={<Link href="/budget/claims/new"><Button size="sm">+ Submit an expense</Button></Link>}
      />

      {reviewer && (
        <>
          <section className="space-y-3">
            <h2 className="text-h2 text-(--color-text-primary)">To review <span className="text-small font-normal text-(--color-text-secondary)">({toReview.length})</span></h2>
            <ClaimList rows={toReview} showWho empty="Nothing waiting for review." />
          </section>
          <section className="space-y-3">
            <h2 className="text-h2 text-(--color-text-primary)">
              To pay back <span className="text-small font-normal text-(--color-text-secondary)">({toPay.length}{toPay.length ? ` · ${formatCurrency(owed)} owed` : ""})</span>
            </h2>
            <ClaimList rows={toPay} showWho empty="No approved refunds waiting to be paid." />
          </section>
        </>
      )}

      <section className="space-y-3">
        <h2 className="text-h2 text-(--color-text-primary)">Your expenses</h2>
        <ClaimList rows={mine} showWho={false} empty="You haven't submitted any expenses yet." />
      </section>

      {reviewer && recent.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-h2 text-(--color-text-primary)">Recently closed</h2>
          <ClaimList rows={recent} showWho empty="" />
        </section>
      )}
    </div>
  );
}
