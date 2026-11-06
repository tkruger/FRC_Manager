"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { approveClaimAction, denyClaimAction, markClaimPaidAction, withdrawClaimAction } from "@/app/actions/expense-claims";
import { PAYMENT_METHODS, type ClaimStatus } from "@/lib/expense-claims";

const inputCls = "h-10 w-full rounded-md border border-(--color-border) bg-(--color-surface) px-3 text-sm text-(--color-text-primary) focus:border-(--color-primary) focus:outline-none";

/** The next step for this claim: review it, pay it back, or (the submitter) withdraw it */
export function ClaimActions({ claimId, status, reimbursement, reviewer, mine, categories, categoryId, today }: {
  claimId: string; status: ClaimStatus; reimbursement: boolean; reviewer: boolean; mine: boolean;
  /** null: this season has no budget yet */
  categories: { id: string; label: string }[] | null;
  categoryId: string | null; today: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [denying, setDenying] = useState(false);
  const [category, setCategory] = useState(categoryId ?? "");
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [method, setMethod] = useState(PAYMENT_METHODS[0]);
  const [reference, setReference] = useState("");
  const [paidOn, setPaidOn] = useState(today);

  function run(fn: () => Promise<{ success: boolean; error?: string }>, done: string) {
    setError(null);
    start(async () => {
      const res = await fn();
      if (!res.success) { setError(res.error ?? "Something went wrong."); return; }
      toast.success(done);
      router.refresh();
    });
  }

  const err = error && <div className="rounded-md bg-(--color-danger)/10 px-3 py-2 text-sm text-(--color-danger)">{error}</div>;

  // The submitter, while it waits
  if (status === "SUBMITTED" && mine && !reviewer) {
    return (
      <section className="card flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-(--color-text-secondary)">Waiting for a Treasurer to review it. You&apos;ll be notified.</p>
        <Button variant="outline" size="sm" isLoading={pending}
          onClick={() => { if (confirm("Withdraw this claim?")) run(() => withdrawClaimAction(claimId), "Claim withdrawn"); }}>
          Withdraw
        </Button>
        {err}
      </section>
    );
  }
  if (!reviewer) return null;

  if (status === "SUBMITTED") {
    if (mine) {
      return (
        <section className="card flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-(--color-text-secondary)">This is your own claim — another Treasurer or a Head Mentor reviews it.</p>
          <Button variant="outline" size="sm" isLoading={pending}
            onClick={() => { if (confirm("Withdraw this claim?")) run(() => withdrawClaimAction(claimId), "Claim withdrawn"); }}>
            Withdraw
          </Button>
          {err}
        </section>
      );
    }
    return (
      <section className="card space-y-4">
        <h2 className="text-h3 text-(--color-text-primary)">Review</h2>
        {err}
        {categories === null ? (
          <p className="text-sm text-(--color-warning)">
            This season has no budget yet, so an approved expense has nowhere to go. <Link href="/budget/setup" className="underline">Set up the budget</Link> first.
          </p>
        ) : !denying ? (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1.5">
                <span className="block text-sm font-medium text-(--color-text-primary)">Budget category</span>
                <select className={inputCls} value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option value="">Uncategorized</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </label>
              <label className="block space-y-1.5">
                <span className="block text-sm font-medium text-(--color-text-primary)">Note <span className="font-normal text-(--color-text-secondary)">(optional)</span></span>
                <input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button isLoading={pending} onClick={() => run(() => approveClaimAction(claimId, { categoryId: category || null, note: note || undefined }),
                reimbursement ? "Approved — now waiting to be paid back" : "Approved and recorded in the budget")}>
                {reimbursement ? "Approve refund" : "Approve and record"}
              </Button>
              <Button variant="outline" disabled={pending} onClick={() => setDenying(true)}>Deny…</Button>
            </div>
            <p className="text-xs text-(--color-text-secondary)">Approving records it in this season&apos;s budget{reimbursement ? "; then mark it paid once they've been paid back" : ""}.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <label className="block space-y-1.5">
              <span className="block text-sm font-medium text-(--color-text-primary)">Why is it denied?</span>
              <input className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} autoFocus
                placeholder="e.g. The receipt is missing the total — please resubmit with the full receipt" />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button variant="danger" isLoading={pending} onClick={() => run(() => denyClaimAction(claimId, reason), "Claim denied")}>Deny claim</Button>
              <Button variant="outline" disabled={pending} onClick={() => setDenying(false)}>Cancel</Button>
            </div>
          </div>
        )}
      </section>
    );
  }

  if (status === "APPROVED" && reimbursement) {
    return (
      <section className="card space-y-4">
        <h2 className="text-h3 text-(--color-text-primary)">Mark paid</h2>
        {err}
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block space-y-1.5">
            <span className="block text-sm font-medium text-(--color-text-primary)">Paid by</span>
            <select className={inputCls} value={method} onChange={(e) => setMethod(e.target.value)}>
              {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="block text-sm font-medium text-(--color-text-primary)">Reference <span className="font-normal text-(--color-text-secondary)">(optional)</span></span>
            <input className={inputCls} value={reference} onChange={(e) => setReference(e.target.value)} maxLength={120} placeholder="Check #, transaction ID" />
          </label>
          <label className="block space-y-1.5">
            <span className="block text-sm font-medium text-(--color-text-primary)">Paid on</span>
            <input type="date" className={inputCls} value={paidOn} max={today} onChange={(e) => setPaidOn(e.target.value)} />
          </label>
        </div>
        <Button isLoading={pending} onClick={() => run(() => markClaimPaidAction(claimId, { method, reference: reference || undefined, paidOn }), "Marked paid — claim closed")}>
          Mark paid and close
        </Button>
      </section>
    );
  }
  return null;
}
