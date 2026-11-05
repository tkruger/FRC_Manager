import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { PageTitle } from "@/components/PageHeader";
import { formatCurrency } from "@/lib/utils";
import { canReviewClaims, claimStatusInfo } from "@/lib/expense-claims";
import { ChangeHistory } from "@/components/history/ChangeHistory";
import { FALLBACK_TIMEZONE, isValidTimezone, localParts } from "@/lib/notify/time";
import { ClaimActions } from "./ClaimActions";

const DAY = (d: Date) => d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const WHEN = (d: Date, tz: string) => d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: tz });

/** One expense claim: its details and receipts, and the review / payment steps */
export default async function ClaimPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.teamId) redirect("/dashboard");
  const reviewer = canReviewClaims(session.user.roles);

  const [claim, team] = await Promise.all([
    prisma.expenseClaim.findFirst({
      where:  { id, teamId: session.user.teamId },
      select: {
        id: true, contact: true, expenseDate: true, amount: true, description: true, vendor: true, paidWith: true,
        reimbursement: true, status: true, reviewedAt: true, reviewNote: true, paidAt: true, paymentMethod: true,
        paymentReference: true, createdAt: true, submittedById: true, categoryId: true, expenseId: true,
        submittedBy: { select: { name: true, email: true } },
        reviewedBy: { select: { name: true } }, paidBy: { select: { name: true } },
        category: { select: { label: true } },
        receipts: { orderBy: { createdAt: "asc" }, select: { id: true, fileName: true, contentType: true, size: true } },
      },
    }),
    prisma.team.findUnique({ where: { id: session.user.teamId }, select: { timezone: true } }),
  ]);
  // Its submitter and the reviewers only
  if (!claim || !(reviewer || claim.submittedById === session.user.id)) notFound();
  const tz = isValidTimezone(team?.timezone) ? team!.timezone! : FALLBACK_TIMEZONE;
  const info = claimStatusInfo(claim.status, claim.reimbursement);
  const mine = claim.submittedById === session.user.id;

  const categories = reviewer && claim.status === "SUBMITTED"
    ? (await prisma.budget.findFirst({
        where:  { season: { teamId: session.user.teamId, isActive: true } },
        select: { categories: { where: { notUsed: false }, select: { id: true, label: true }, orderBy: { label: "asc" } } },
      }))?.categories ?? null
    : [];

  const rows: [string, React.ReactNode][] = [
    ["Submitted by", <>{claim.submittedBy?.name ?? "Former member"}{claim.submittedBy?.email && !claim.submittedBy.email.endsWith(".invalid") ? <span className="text-(--color-text-secondary)"> · {claim.submittedBy.email}</span> : null}</>],
    ["Contact", claim.contact],
    ["Expense date", DAY(claim.expenseDate)],
    ["Vendor", claim.vendor ?? "—"],
    ["Paid with", claim.paidWith ?? "—"],
    ["Budget category", claim.category?.label ?? (claim.status === "SUBMITTED" ? "The Treasurer picks it" : "Uncategorized")],
    ["Refund", claim.reimbursement ? "Yes — they want to be paid back" : "No"],
    ["Submitted", WHEN(claim.createdAt, tz)],
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div>
        <nav className="text-small text-(--color-text-secondary) mb-1">
          <Link href="/budget" className="hover:text-(--color-primary)">Budget</Link>
          <span className="mx-2">›</span>
          <Link href="/budget/claims" className="hover:text-(--color-primary)">Expenses</Link>
          <span className="mx-2">›</span>Claim
        </nav>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <PageTitle help="expenses">{claim.description}</PageTitle>
          <span className="text-h1 font-bold tabular-nums text-(--color-text-primary)">{formatCurrency(claim.amount)}</span>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <Badge variant={info.badge}>{info.label}</Badge>
          {claim.reimbursement && <Badge variant="info">Refund</Badge>}
        </div>
      </div>

      {/* Where it stands */}
      {claim.status !== "SUBMITTED" && claim.status !== "WITHDRAWN" && (
        <div className={`card text-sm space-y-1 border-l-4 ${claim.status === "DENIED" ? "border-l-(--color-danger)" : "border-l-(--color-success)"}`}>
          {claim.reviewedAt && (
            <p className="text-(--color-text-primary)">
              <b>{claim.status === "DENIED" ? "Denied" : "Approved"}</b> by {claim.reviewedBy?.name ?? "someone"} on {WHEN(claim.reviewedAt, tz)}
              {claim.status !== "DENIED" && claim.expenseId && " — recorded in the budget"}.
            </p>
          )}
          {claim.reviewNote && <p className="text-(--color-text-secondary)">{claim.status === "DENIED" ? "Reason" : "Note"}: {claim.reviewNote}</p>}
          {claim.status === "PAID" && claim.paidAt && (
            <p className="text-(--color-text-primary)">
              <b>Paid back</b> by {claim.paymentMethod}{claim.paymentReference ? ` (${claim.paymentReference})` : ""} on {DAY(claim.paidAt)}
              {claim.paidBy ? ` — marked by ${claim.paidBy.name}` : ""}.
            </p>
          )}
          {claim.status === "APPROVED" && claim.reimbursement && <p className="text-(--color-text-secondary)">Waiting to be paid back.</p>}
        </div>
      )}

      <section className="card">
        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[10rem_1fr] text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-(--color-text-secondary)">{k}</dt>
              <dd className="text-(--color-text-primary) wrap-break-word">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="card space-y-3">
        <h2 className="text-h3 text-(--color-text-primary)">Receipts</h2>
        {claim.receipts.length === 0 ? (
          <p className="text-small text-(--color-text-secondary)">No receipts attached.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {claim.receipts.map((r) => (
              <li key={r.id} className="rounded-md border border-(--color-border) overflow-hidden">
                {r.contentType.startsWith("image/") ? (
                  <a href={`/api/expense-receipts/${r.id}`} target="_blank" rel="noopener noreferrer" className="block bg-(--color-surface-overlay)">
                    {/* eslint-disable-next-line @next/next/no-img-element -- private, served by our own route */}
                    <img src={`/api/expense-receipts/${r.id}`} alt={r.fileName} className="h-48 w-full object-contain" />
                  </a>
                ) : (
                  <a href={`/api/expense-receipts/${r.id}`} target="_blank" rel="noopener noreferrer" className="flex h-24 items-center justify-center gap-2 bg-(--color-surface-overlay) text-sm font-medium text-(--color-secondary) hover:underline">
                    📄 Open PDF
                  </a>
                )}
                <div className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
                  <span className="truncate text-(--color-text-secondary)">{r.fileName}</span>
                  <a href={`/api/expense-receipts/${r.id}?download=1`} className="shrink-0 text-(--color-secondary) hover:underline">Download</a>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ClaimActions
        claimId={claim.id}
        status={claim.status}
        reimbursement={claim.reimbursement}
        reviewer={reviewer}
        mine={mine}
        categories={categories}
        categoryId={claim.categoryId}
        today={localParts(new Date(), tz).dateKey}
      />

      <ChangeHistory entityType="expense" entityId={claim.id} />
    </div>
  );
}
