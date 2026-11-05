"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { setupBudgetAction } from "@/app/actions/budget";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import type { BudgetCategory } from "@/generated/prisma";

const DEFAULT_CATEGORIES = [
  { type: "REGISTRATION_FEES",  label: "Registration & Competition Fees",  suggested: 5000 },
  { type: "ROBOT_MECHANICAL",   label: "Robot Parts — Mechanical",          suggested: 3000 },
  { type: "ROBOT_ELECTRICAL",   label: "Robot Parts — Electrical",          suggested: 2000 },
  { type: "ROBOT_PNEUMATICS",   label: "Robot Parts — Pneumatics",          suggested: 500  },
  { type: "RAW_MATERIALS",      label: "Raw Materials",                     suggested: 1000 },
  { type: "TOOLS_EQUIPMENT",    label: "Tools & Equipment",                 suggested: 500  },
  { type: "CONSUMABLES",        label: "Consumables",                       suggested: 300  },
  { type: "SAFETY_EQUIPMENT",   label: "Safety Equipment",                  suggested: 200  },
  { type: "TRAVEL_HOTEL",       label: "Travel & Hotel",                    suggested: 3000 },
  { type: "FOOD_MEALS",         label: "Food & Meals",                      suggested: 500  },
  { type: "AWARDS_OUTREACH",    label: "Awards & Outreach",                 suggested: 300  },
  { type: "CONTINGENCY",        label: "Contingency Reserve (10–15%)",      suggested: 1500 },
  { type: "SHIPPING",           label: "Shipping (orders' shipping charges)", suggested: 400 },
];

interface Props {
  existing: { categories: BudgetCategory[] } | null;
}

export function BudgetSetupForm({ existing }: Props) {
  const router = useRouter();
  const [state, action, pending] = useActionState(setupBudgetAction, null);

  useEffect(() => {
    if (state?.success) router.push("/budget");
  }, [state, router]);

  // A saved budget keeps what was saved — $0 included; a new one starts from the suggestions
  function startingAmount(cat: { type: string; suggested: number }) {
    if (!existing) return cat.suggested;
    return existing.categories.find((c) => c.type === cat.type)?.allocation ?? 0;
  }
  const [off, setOff] = useState<Set<string>>(() => new Set(existing?.categories.filter((c) => c.notUsed).map((c) => c.type) ?? []));
  const toggleOff = (type: string, on: boolean) => setOff((prev) => { const next = new Set(prev); if (on) next.add(type); else next.delete(type); return next; });

  return (
    <form action={action} className="space-y-6">
      {state && !state.success && (
        <div className="rounded-md bg-(--color-danger)/10 border border-(--color-danger)/20 px-4 py-3 text-sm text-(--color-danger)">
          {state.error}
        </div>
      )}

      <p className="text-small text-(--color-text-secondary)">
        The allocations below add up to the budget goal. Money raised (and pledged) comes from the
        <b> Funding sources</b> on the Budget page — including what the team puts in from its own account.
      </p>

      <div className="card space-y-4">
        <h2 className="text-h3 text-(--color-text-primary)">Category allocations</h2>
        <p className="text-small text-(--color-text-secondary)">
          Set a spending limit for each category{existing ? "" : " — the amounts filled in are typical for an FRC team"}. Tick
          <b> Not used</b> for anything your team doesn&apos;t spend on (no pneumatics, say): it&apos;s $0 and hidden from the budget
          and from the categories people pick on orders and expenses.
        </p>
        <div className="space-y-3">
          {DEFAULT_CATEGORIES.map((cat) => {
            const notUsed = off.has(cat.type);
            return (
              <div key={cat.type} className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <label htmlFor={`cat_${cat.type}`} className={`min-w-40 flex-1 text-sm ${notUsed ? "text-(--color-text-disabled) line-through" : "text-(--color-text-primary)"}`}>{cat.label}</label>
                <label className="flex items-center gap-1.5 text-small text-(--color-text-secondary) cursor-pointer">
                  <input type="checkbox" name={`off_${cat.type}`} className="rounded" checked={notUsed} onChange={(e) => toggleOff(cat.type, e.target.checked)} />
                  Not used
                </label>
                <div className="w-36">
                  <Field
                    label=""
                    id={`cat_${cat.type}`}
                    name={`cat_${cat.type}`}
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue={startingAmount(cat)}
                    placeholder={`$${cat.suggested}`}
                    disabled={notUsed}
                    aria-label={`${cat.label} allocation`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex gap-3 sticky bottom-0 bg-(--color-surface) border-t border-(--color-border) -mx-4 px-4 py-4 sm:-mx-6 sm:px-6">
        <Button type="submit" isLoading={pending}>
          {existing ? "Update budget" : "Create budget"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
      </div>
    </form>
  );
}
