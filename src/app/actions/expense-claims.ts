"use server";

// Expense claims. Anyone on the team (parents too) reports money spent for the team, with
// receipts, and can ask to be paid back. Treasurers (or Head Mentors) approve — recording it
// in the budget — or deny it; approved refunds are then marked paid. Nobody reviews their own
// claim; a reviewer's own team-card purchase (no refund) is recorded straight away.

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { issueMessage } from "@/lib/validation";
import { notifyUsers } from "@/lib/notify/deliver";
import { canReviewClaims, MAX_RECEIPTS } from "@/lib/expense-claims";
import { formatCurrency } from "@/lib/utils";
import type { Prisma } from "@/generated/prisma";

type Result<T = object> = ({ success: true } & T) | { success: false; error: string };

async function me() {
  const session = await auth();
  if (!session?.user?.id || !session.user.teamId) return null;
  return { id: session.user.id, name: session.user.name ?? "Someone", teamId: session.user.teamId, roles: session.user.roles as string[] };
}

function refresh(id?: string) {
  revalidatePath("/budget");
  revalidatePath("/budget/claims");
  if (id) revalidatePath(`/budget/claims/${id}`);
}

const link = (id: string) => `/budget/claims/${id}`;
const money = (n: number) => Math.round(n * 100) / 100;

/** The active season's budget (expenses are recorded in it) */
async function activeBudget(teamId: string) {
  return prisma.budget.findFirst({ where: { season: { teamId, isActive: true } }, select: { id: true } });
}

/** Treasurers review claims; a team without one has its Head Mentors do it */
async function reviewerIds(teamId: string, exclude: string): Promise<string[]> {
  const find = (role: "TREASURER" | "HEAD_MENTOR") => prisma.user.findMany({
    where: { teamId, status: "ACTIVE", deletedAt: null, roles: { some: { role } } }, select: { id: true },
  });
  let ids = (await find("TREASURER")).map((u) => u.id).filter((id) => id !== exclude);
  if (ids.length === 0) ids = (await find("HEAD_MENTOR")).map((u) => u.id).filter((id) => id !== exclude);
  return ids;
}

/** Record an approved claim in the budget (in its category) */
async function recordInBudget(tx: Prisma.TransactionClient, claim: {
  id: string; expenseDate: Date; amount: number; vendor: string | null; description: string; paidWith: string | null; reimbursement: boolean; submitter: string;
}, budgetId: string, categoryId: string | null) {
  const expense = await tx.expense.create({
    data: {
      budgetId, categoryId,
      date: claim.expenseDate,
      amount: claim.amount,
      vendor: claim.vendor,
      description: claim.reimbursement ? `${claim.description} (paid by ${claim.submitter})` : claim.description,
      paymentMethod: claim.paidWith,
    },
    select: { id: true },
  });
  return expense.id;
}

// ── Submitting ──────────────────────────────────────────────────────────────

const SubmitSchema = z.object({
  contact:       z.string().trim().min(3, "Say how to reach you (email, phone or Discord).").max(200),
  expenseDate:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick the date you spent it."),
  amount:        z.number().positive("Enter the amount.").max(100_000, "That's more than an expense claim can be."),
  description:   z.string().trim().min(2, "Describe what it was for.").max(300),
  vendor:        z.string().trim().max(120).optional(),
  paidWith:      z.string().trim().max(60).optional(),
  categoryId:    z.string().max(100).nullable().optional(),
  reimbursement: z.boolean(),
  receiptIds:    z.array(z.string().max(100)).max(MAX_RECEIPTS, `Attach up to ${MAX_RECEIPTS} receipts.`),
});

export async function submitClaimAction(input: unknown): Promise<Result<{ id: string; recorded: boolean }>> {
  const who = await me();
  if (!who) return { success: false, error: "Not authenticated." };
  const parsed = SubmitSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: issueMessage(parsed.error) };
  const d = parsed.data;

  const date = new Date(`${d.expenseDate}T00:00:00Z`);
  if (date.getTime() > Date.now() + 2 * 86_400_000) return { success: false, error: "The expense date is in the future." };
  if (d.reimbursement && d.receiptIds.length === 0) return { success: false, error: "Attach the receipt so the Treasurer can pay you back." };

  const budget = await activeBudget(who.teamId);
  if (d.categoryId) {
    const ok = budget && await prisma.budgetCategory.findFirst({ where: { id: d.categoryId, budgetId: budget.id }, select: { id: true } });
    if (!ok) return { success: false, error: "That budget category isn't in this season's budget." };
  }
  const receipts = await prisma.expenseReceipt.findMany({
    where:  { id: { in: d.receiptIds }, uploadedById: who.id, teamId: who.teamId, claimId: null },
    select: { id: true },
  });
  if (receipts.length !== d.receiptIds.length) return { success: false, error: "A receipt didn't finish uploading. Remove it and add it again." };

  // A reviewer's own purchase that needs no refund is simply recorded
  const recordNow = !d.reimbursement && canReviewClaims(who.roles);
  if (recordNow && !budget) return { success: false, error: "Set up this season's budget first (Budget → Set up)." };

  const claim = await prisma.$transaction(async (tx) => {
    const c = await tx.expenseClaim.create({
      data: {
        teamId: who.teamId, submittedById: who.id,
        contact: d.contact, expenseDate: date, amount: money(d.amount), description: d.description,
        vendor: d.vendor || null, paidWith: d.paidWith || null, categoryId: d.categoryId || null,
        reimbursement: d.reimbursement,
      },
      select: { id: true, expenseDate: true, amount: true, vendor: true, description: true, paidWith: true, reimbursement: true, categoryId: true },
    });
    if (receipts.length) await tx.expenseReceipt.updateMany({ where: { id: { in: receipts.map((r) => r.id) } }, data: { claimId: c.id } });
    if (recordNow) {
      const expenseId = await recordInBudget(tx, { ...c, submitter: who.name }, budget!.id, c.categoryId);
      await tx.expenseClaim.update({
        where: { id: c.id },
        data:  { status: "APPROVED", reviewedById: who.id, reviewedAt: new Date(), reviewNote: "Recorded directly (no refund needed)", expenseId },
      });
    }
    return c;
  });

  if (!recordNow) {
    await notifyUsers(await reviewerIds(who.teamId, who.id), {
      topic: "expenses.review", type: "EXPENSE_CLAIM",
      title: d.reimbursement ? `💵 Refund request: ${formatCurrency(claim.amount)} from ${who.name}` : `🧾 Expense to review: ${formatCurrency(claim.amount)}`,
      body: `${d.description}${d.vendor ? ` — ${d.vendor}` : ""} (${d.expenseDate}). ${receipts.length} receipt${receipts.length === 1 ? "" : "s"}.`,
      url: link(claim.id), tag: `claim-${claim.id}`,
    }).catch((e) => console.error("[claims] notify reviewers", e));
  }
  refresh(claim.id);
  return { success: true, id: claim.id, recorded: recordNow };
}

/** Take back your own claim before it's reviewed */
export async function withdrawClaimAction(id: string): Promise<Result> {
  const who = await me();
  if (!who) return { success: false, error: "Not authenticated." };
  const { count } = await prisma.expenseClaim.updateMany({
    where: { id: String(id), teamId: who.teamId, submittedById: who.id, status: "SUBMITTED" },
    data:  { status: "WITHDRAWN" },
  });
  if (!count) return { success: false, error: "Only a claim still waiting for review can be withdrawn." };
  refresh(String(id));
  return { success: true };
}

// ── Reviewing (Treasurers, Head Mentors) ────────────────────────────────────

async function reviewable(id: string) {
  const who = await me();
  if (!who) return { error: "Not authenticated." } as const;
  if (!canReviewClaims(who.roles)) return { error: "Only Treasurers and Head Mentors can review expense claims." } as const;
  const claim = await prisma.expenseClaim.findFirst({
    where:  { id: String(id), teamId: who.teamId },
    select: {
      id: true, status: true, submittedById: true, expenseDate: true, amount: true, vendor: true, description: true,
      paidWith: true, reimbursement: true, categoryId: true, submittedBy: { select: { name: true } },
    },
  });
  if (!claim) return { error: "Claim not found." } as const;
  return { who, claim } as const;
}

const ApproveSchema = z.object({
  categoryId: z.string().max(100).nullable(),
  note:       z.string().trim().max(500).optional(),
});

/** Approve: record it in the budget (in the category picked); a refund then waits to be paid */
export async function approveClaimAction(id: string, input: unknown): Promise<Result> {
  const r = await reviewable(id);
  if (r.error !== undefined) return { success: false, error: r.error };
  const { who, claim } = r;
  if (claim.status !== "SUBMITTED") return { success: false, error: "This claim has already been reviewed." };
  if (claim.submittedById === who.id) return { success: false, error: "Someone else needs to approve your own claim." };
  const parsed = ApproveSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: issueMessage(parsed.error) };

  const budget = await activeBudget(who.teamId);
  if (!budget) return { success: false, error: "Set up this season's budget first, so the expense has somewhere to go." };
  const categoryId = parsed.data.categoryId || null;
  if (categoryId && !await prisma.budgetCategory.findFirst({ where: { id: categoryId, budgetId: budget.id }, select: { id: true } })) {
    return { success: false, error: "That budget category isn't in this season's budget." };
  }

  await prisma.$transaction(async (tx) => {
    const expenseId = await recordInBudget(tx, { ...claim, submitter: claim.submittedBy?.name ?? "a former member" }, budget.id, categoryId);
    await tx.expenseClaim.update({
      where: { id: claim.id },
      data:  { status: "APPROVED", categoryId, reviewedById: who.id, reviewedAt: new Date(), reviewNote: parsed.data.note || null, expenseId },
    });
  });
  if (claim.submittedById) {
    await notifyUsers([claim.submittedById], {
      topic: "expenses.mine", type: "EXPENSE_CLAIM",
      title: `✅ Expense approved: ${formatCurrency(claim.amount)}`,
      body: claim.reimbursement
        ? `${claim.description} — ${who.name} approved it; you'll be paid back soon.${parsed.data.note ? ` Note: ${parsed.data.note}` : ""}`
        : `${claim.description} — ${who.name} recorded it in the budget.${parsed.data.note ? ` Note: ${parsed.data.note}` : ""}`,
      url: link(claim.id), tag: `claim-${claim.id}`,
    }).catch((e) => console.error("[claims] notify approved", e));
  }
  refresh(claim.id);
  return { success: true };
}

/** Deny, with the reason (the submitter is told) */
export async function denyClaimAction(id: string, reason: string): Promise<Result> {
  const r = await reviewable(id);
  if (r.error !== undefined) return { success: false, error: r.error };
  const { who, claim } = r;
  if (claim.status !== "SUBMITTED") return { success: false, error: "This claim has already been reviewed." };
  if (claim.submittedById === who.id) return { success: false, error: "Someone else needs to review your own claim (or withdraw it)." };
  const why = String(reason ?? "").trim();
  if (why.length < 3) return { success: false, error: "Say why it's denied, so they know what to fix." };

  await prisma.expenseClaim.update({
    where: { id: claim.id },
    data:  { status: "DENIED", reviewedById: who.id, reviewedAt: new Date(), reviewNote: why.slice(0, 500) },
  });
  if (claim.submittedById) {
    await notifyUsers([claim.submittedById], {
      topic: "expenses.mine", type: "EXPENSE_CLAIM",
      title: `Expense not approved: ${formatCurrency(claim.amount)}`,
      body: `${claim.description} — ${who.name}: ${why}`,
      url: link(claim.id), tag: `claim-${claim.id}`,
    }).catch((e) => console.error("[claims] notify denied", e));
  }
  refresh(claim.id);
  return { success: true };
}

const PaidSchema = z.object({
  method:    z.string().trim().min(2, "How was it paid?").max(60),
  reference: z.string().trim().max(120).optional(),
  paidOn:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick the date it was paid."),
});

/** An approved refund was paid: close it */
export async function markClaimPaidAction(id: string, input: unknown): Promise<Result> {
  const r = await reviewable(id);
  if (r.error !== undefined) return { success: false, error: r.error };
  const { who, claim } = r;
  if (claim.status !== "APPROVED" || !claim.reimbursement) return { success: false, error: "Only an approved refund can be marked paid." };
  const parsed = PaidSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: issueMessage(parsed.error) };

  await prisma.expenseClaim.update({
    where: { id: claim.id },
    data:  {
      status: "PAID", paidById: who.id, paidAt: new Date(`${parsed.data.paidOn}T12:00:00Z`),
      paymentMethod: parsed.data.method, paymentReference: parsed.data.reference || null,
    },
  });
  if (claim.submittedById) {
    await notifyUsers([claim.submittedById], {
      topic: "expenses.mine", type: "EXPENSE_CLAIM",
      title: `💵 You've been paid back: ${formatCurrency(claim.amount)}`,
      body: `${claim.description} — paid by ${parsed.data.method}${parsed.data.reference ? ` (${parsed.data.reference})` : ""} on ${parsed.data.paidOn}.`,
      url: link(claim.id), tag: `claim-${claim.id}`,
    }).catch((e) => console.error("[claims] notify paid", e));
  }
  refresh(claim.id);
  return { success: true };
}
