"use client";

import { useRef, useState, useTransition } from "react";
import { shrinkImage } from "@/lib/shrink-image";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { formatCurrency } from "@/lib/utils";
import { submitClaimAction } from "@/app/actions/expense-claims";
import { MAX_RECEIPTS, MAX_RECEIPT_BYTES, PAID_WITH_OPTIONS, RECEIPT_TYPES } from "@/lib/expense-claims";

interface Receipt { id: string; fileName: string; contentType: string; size: number }

const inputCls = "h-11 w-full rounded-md border border-(--color-border) bg-(--color-surface) px-3 text-sm text-(--color-text-primary) focus:border-(--color-primary) focus:outline-none";
const label = "block text-sm font-medium text-(--color-text-primary)";

const sizeText = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export function ClaimForm({ email, contact, categories, canRecordDirectly, today }: {
  email: string; contact: string; categories: { id: string; label: string }[]; canRecordDirectly: boolean; today: string;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [uploading, setUploading] = useState(0);
  const [refund, setRefund] = useState(false);
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    const room = MAX_RECEIPTS - receipts.length;
    for (const original of [...files].slice(0, room)) {
      setUploading((n) => n + 1);
      try {
        const file = await shrinkImage(original);
        if (file.size > MAX_RECEIPT_BYTES) { setError(`“${original.name}” is too big — receipts can be up to ${MAX_RECEIPT_BYTES / 1024 / 1024} MB.`); continue; }
        const body = new FormData();
        body.append("file", file);
        const res = await fetch("/api/expense-receipts", { method: "POST", body });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) { setError(data.error ?? "That receipt didn't upload. Try again."); continue; }
        setReceipts((list) => [...list, data as Receipt]);
      } catch {
        setError("That receipt didn't upload. Check your connection and try again.");
      } finally {
        setUploading((n) => n - 1);
      }
    }
    if (files.length > room) setError(`Up to ${MAX_RECEIPTS} receipts per claim — one invoice or receipt per claim is best.`);
    if (fileRef.current) fileRef.current.value = "";
  }

  function removeReceipt(id: string) {
    setReceipts((list) => list.filter((r) => r.id !== id));
    fetch(`/api/expense-receipts/${id}`, { method: "DELETE" }).catch(() => {});
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const value = Number(String(amount).replace(/[$,\s]/g, ""));
    if (!(value > 0)) { setError("Enter the amount."); return; }
    setError(null);
    start(async () => {
      const res = await submitClaimAction({
        contact:       String(fd.get("contact") ?? ""),
        expenseDate:   String(fd.get("expenseDate") ?? ""),
        amount:        value,
        description:   String(fd.get("description") ?? ""),
        vendor:        String(fd.get("vendor") ?? "") || undefined,
        paidWith:      String(fd.get("paidWith") ?? "") || undefined,
        categoryId:    String(fd.get("categoryId") ?? "") || null,
        reimbursement: refund,
        receiptIds:    receipts.map((r) => r.id),
      });
      if (!res.success) { setError(res.error); return; }
      toast.success(res.recorded ? "Expense recorded in the budget" : refund ? "Sent to the Treasurer — you'll hear when it's approved" : "Sent to the Treasurer for review");
      router.push(`/budget/claims/${res.id}`);
    });
  }

  return (
    <form onSubmit={submit} className="card space-y-5">
      {error && <div className="rounded-md bg-(--color-danger)/10 px-3 py-2 text-sm text-(--color-danger)">{error}</div>}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1.5">
          <span className={label}>Email</span>
          <input className={`${inputCls} opacity-80`} value={email} readOnly aria-readonly />
          <span className="block text-xs text-(--color-text-secondary)">From your account</span>
        </label>
        <label className="block space-y-1.5">
          <span className={label}>Contact information <span className="text-(--color-danger)">*</span></span>
          <input name="contact" className={inputCls} defaultValue={contact} required maxLength={200} />
          <span className="block text-xs text-(--color-text-secondary)">Email, phone number or Discord user to reach you with questions</span>
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1.5">
          <span className={label}>Expense date <span className="text-(--color-danger)">*</span></span>
          <input name="expenseDate" type="date" className={inputCls} defaultValue={today} max={today} required />
        </label>
        <label className="block space-y-1.5">
          <span className={label}>Expense amount <span className="text-(--color-danger)">*</span></span>
          <input className={inputCls} inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          {Number(amount) > 0 && <span className="block text-xs text-(--color-text-secondary)">{formatCurrency(Number(amount))}</span>}
        </label>
      </div>

      <label className="block space-y-1.5">
        <span className={label}>Expense description <span className="text-(--color-danger)">*</span></span>
        <input name="description" className={inputCls} required maxLength={300} placeholder="e.g. Pizza for the Saturday build session" />
      </label>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block space-y-1.5">
          <span className={label}>Vendor <span className="font-normal text-(--color-text-secondary)">(optional)</span></span>
          <input name="vendor" className={inputCls} maxLength={120} placeholder="Store or website" />
        </label>
        <label className="block space-y-1.5">
          <span className={label}>Paid with</span>
          <select name="paidWith" className={inputCls} defaultValue="">
            <option value="">Choose…</option>
            {PAID_WITH_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </label>
        <label className="block space-y-1.5">
          <span className={label}>Budget category <span className="font-normal text-(--color-text-secondary)">(if you know)</span></span>
          <select name="categoryId" className={inputCls} defaultValue="">
            <option value="">Treasurer picks</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </label>
      </div>

      {/* Receipts */}
      <div className="space-y-2">
        <span className={label}>Receipts {refund && <span className="text-(--color-danger)">*</span>}</span>
        <p className="text-xs text-(--color-text-secondary)">Photos or PDFs of the receipt or invoice. One receipt per claim is best — submit separate purchases separately.</p>
        {receipts.length > 0 && (
          <ul className="space-y-1.5">
            {receipts.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 rounded-md border border-(--color-border) px-3 py-2 text-sm">
                <a href={`/api/expense-receipts/${r.id}`} target="_blank" rel="noopener noreferrer" className="min-w-0 truncate text-(--color-secondary) hover:underline">
                  {r.contentType === "application/pdf" ? "📄" : "🖼️"} {r.fileName}
                </a>
                <span className="flex shrink-0 items-center gap-3">
                  <span className="text-xs text-(--color-text-secondary)">{sizeText(r.size)}</span>
                  <Button type="button" variant="dangerOutline" size="xs" onClick={() => removeReceipt(r.id)}>Remove</Button>
                </span>
              </li>
            ))}
          </ul>
        )}
        {receipts.length < MAX_RECEIPTS && (
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-(--color-border) px-4 py-4 text-sm font-medium text-(--color-text-secondary) hover:border-(--color-primary) hover:text-(--color-primary)">
            <input ref={fileRef} type="file" accept={RECEIPT_TYPES} multiple className="sr-only" onChange={(e) => addFiles(e.target.files)} />
            {uploading > 0 ? "Uploading…" : "📎 Add a photo or PDF"}
          </label>
        )}
      </div>

      {/* Refund */}
      <label className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${refund ? "border-(--color-primary) bg-(--color-primary)/5" : "border-(--color-border)"}`}>
        <input type="checkbox" className="mt-0.5 h-4 w-4 accent-(--color-primary)" checked={refund} onChange={(e) => setRefund(e.target.checked)} />
        <span>
          <span className="block text-sm font-semibold text-(--color-text-primary)">I paid for this myself — please pay me back</span>
          <span className="block text-xs text-(--color-text-secondary)">The Treasurer reviews it, then marks it paid once you&apos;ve been reimbursed. You&apos;ll be notified at each step.</span>
        </span>
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" isLoading={pending} disabled={uploading > 0}>{canRecordDirectly && !refund ? "Record expense" : "Submit for review"}</Button>
        <span className="text-xs text-(--color-text-secondary)">
          {canRecordDirectly && !refund ? "You review expenses, so this goes straight into the budget." : "A Treasurer reviews it and records it in the budget."}
        </span>
      </div>
    </form>
  );
}
