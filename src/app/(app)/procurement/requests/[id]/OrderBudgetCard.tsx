"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";
import { formatCurrency } from "@/lib/utils";
import { setOrderBudgetAction } from "@/app/actions/orders";
import { ORDER_BUDGET_OPTIONS, BUDGET_CATEGORY_LABELS } from "@/lib/budget-categories";

type Category = keyof typeof BUDGET_CATEGORY_LABELS;

interface Props {
  requestId: string;
  /** null for orders placed before categories were required */
  budgetCategory: Category | null;
  items: { id: string; ref: string; name: string; total: number; budgetCategory: Category | null }[];
  /** What's in the budget for this order now */
  recorded: { label: string; amount: number; committed: boolean }[];
  canChange: boolean;
}

const selectCls = "w-full rounded-md border border-(--color-border) bg-(--color-surface) text-(--color-text-primary) px-2.5 py-2 text-sm focus:border-(--color-primary) focus:outline-none";

export function OrderBudgetCard({ requestId, budgetCategory, items, recorded, canChange }: Props) {
  const router = useRouter();
  const [editing, setEditing]   = useState(canChange && !budgetCategory);
  const [category, setCategory] = useState<string>(budgetCategory ?? "");
  const [own, setOwn]           = useState<Record<string, string>>(() => Object.fromEntries(items.map((i) => [i.id, i.budgetCategory ?? ""])));
  const [error, setError]       = useState<string | null>(null);
  const [pending, start]        = useTransition();

  const label = (c: string | null) => (c ? BUDGET_CATEGORY_LABELS[c as Category] : "Not set");
  const elsewhere = items.filter((i) => i.budgetCategory && i.budgetCategory !== budgetCategory);

  function save() {
    if (!category) { setError("Choose a budget category for the order."); return; }
    setError(null);
    start(async () => {
      const res = await setOrderBudgetAction({
        requestId, budgetCategory: category,
        items: items.map((i) => ({ id: i.id, budgetCategory: own[i.id] || null })),
      });
      if (!res.success) { setError(res.error); return; }
      toast.success("Budget category saved");
      setEditing(false);
      router.refresh();
    });
  }

  return (
    <section className="card space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-h3 text-(--color-text-primary)">Budget</h2>
          {!editing && (
            <p className="text-sm text-(--color-text-primary) mt-0.5">
              {budgetCategory ? label(budgetCategory) : <span className="text-(--color-warning)">No budget category yet — its spend shows as uncategorized</span>}
              {elsewhere.length > 0 && <span className="text-(--color-text-secondary)"> · {elsewhere.length} item{elsewhere.length === 1 ? "" : "s"} charged elsewhere</span>}
            </p>
          )}
        </div>
        {canChange && !editing && <Button size="sm" variant="outline" onClick={() => setEditing(true)}>Change</Button>}
      </div>

      {editing && (
        <div className="space-y-3">
          {error && <div className="text-sm text-(--color-danger) bg-(--color-danger)/10 rounded px-3 py-2">{error}</div>}
          <label className="block space-y-1.5">
            <span className="block text-sm font-medium text-(--color-text-primary)">Order&apos;s budget category <span className="text-(--color-danger)">*</span></span>
            <select className={selectCls} value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="" disabled>Choose what this order is for…</option>
              {ORDER_BUDGET_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          {items.length > 1 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-(--color-text-primary)">Items charged somewhere else <span className="font-normal text-(--color-text-secondary)">(optional)</span></p>
              <ul className="space-y-2">
                {items.map((i) => (
                  <li key={i.id} className="grid gap-1.5 sm:grid-cols-[1fr_16rem] sm:items-center">
                    <span className="min-w-0 text-sm text-(--color-text-primary) truncate">
                      <span className="font-mono text-xs text-(--color-text-secondary) mr-1.5">{i.ref}</span>{i.name}
                      <span className="text-(--color-text-secondary)"> · {formatCurrency(i.total)}</span>
                    </span>
                    <select className={selectCls} value={own[i.id] ?? ""} onChange={(e) => setOwn((m) => ({ ...m, [i.id]: e.target.value }))} aria-label={`Budget category for ${i.name}`}>
                      <option value="">Same as order</option>
                      {ORDER_BUDGET_OPTIONS.filter((o) => o.value !== category).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex gap-2">
            <Button size="sm" onClick={save} isLoading={pending}>Save</Button>
            {budgetCategory && <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>}
          </div>
        </div>
      )}

      {recorded.length > 0 ? (
        <ul className="border-t border-(--color-border) pt-3 space-y-1">
          {recorded.map((r) => (
            <li key={r.label} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="text-(--color-text-primary)">{r.label}</span>
              <span className="flex items-center gap-2">
                {r.committed && <Badge variant="info">Committed</Badge>}
                <span className="font-medium text-(--color-text-primary)">{formatCurrency(r.amount)}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-small text-(--color-text-secondary)">Shows on the budget as committed once everything is ordered, and as spent when it arrives.</p>
      )}
    </section>
  );
}
