import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageTitle } from "@/components/PageHeader";
import { canReviewClaims } from "@/lib/expense-claims";
import { FALLBACK_TIMEZONE, isValidTimezone, localParts } from "@/lib/notify/time";
import { ClaimForm } from "./ClaimForm";

/** Submit an expense (with receipts), optionally asking to be paid back */
export default async function NewClaimPage() {
  const session = await auth();
  if (!session?.user?.teamId) redirect("/dashboard");

  const [me, team, budget] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.user.id }, select: { email: true, phone: true } }),
    prisma.team.findUnique({ where: { id: session.user.teamId }, select: { timezone: true } }),
    prisma.budget.findFirst({
      where:  { season: { teamId: session.user.teamId, isActive: true } },
      select: { categories: { select: { id: true, label: true }, orderBy: { label: "asc" } } },
    }),
  ]);
  const tz = isValidTimezone(team?.timezone) ? team!.timezone! : FALLBACK_TIMEZONE;
  const email = me?.email.endsWith(".invalid") ? "" : me?.email ?? "";

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div>
        <nav className="text-small text-(--color-text-secondary) mb-1">
          <Link href="/budget" className="hover:text-(--color-primary)">Budget</Link>
          <span className="mx-2">›</span>
          <Link href="/budget/claims" className="hover:text-(--color-primary)">Expenses</Link>
          <span className="mx-2">›</span>New
        </nav>
        <PageTitle help="expenses">Submit an expense</PageTitle>
        <p className="text-body text-(--color-text-secondary) mt-1">
          Thank you for helping the team! Report what you spent, attach the receipt, and tick the box if you paid
          yourself and want to be paid back.
        </p>
      </div>
      <ClaimForm
        email={email}
        contact={[me?.phone, email].filter(Boolean).join(" · ")}
        categories={budget?.categories ?? []}
        canRecordDirectly={canReviewClaims(session.user.roles)}
        today={localParts(new Date(), tz).dateKey}
      />
    </div>
  );
}
