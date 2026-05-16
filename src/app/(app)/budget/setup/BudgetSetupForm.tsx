"use client";

import { useActionState, useEffect } from "react";
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
];

interface Props {
  existing: { totalEstRevenue: number; categories: BudgetCategory[] } | null;
}

export function BudgetSetupForm({ existing }: Props) {
  const router = useRouter();
  const [state, action, pending] = useActionState(setupBudgetAction, null);

  useEffect(() => {
    if (state?.success) router.push("/budget");
  }, [state, router]);

  function getAllocation(type: string) {
    return existing?.categories.find((c) => c.type === type)?.allocation ?? 0;
  }

  return (
    <form action={action} className="space-y-6">
      {state && !state.success && (
        <div className="rounded-md bg-[--color-danger]/10 border border-[--color-danger]/20 px-4 py-3 text-sm text-[--color-danger]">
          {state.error}
        </div>
      )}

      <div className="card space-y-4">
        <h2 className="text-h3 text-[--color-text-primary]">Revenue</h2>
        <Field
          label="Total estimated revenue ($)"
          name="totalEstRevenue"
          type="number"
          step="0.01"
          required
          defaultValue={existing?.totalEstRevenue ?? 0}
          hint="Sum of all expected funding (sponsorships, school allocation, grants, fundraising)"
        />
      </div>

      <div className="card space-y-4">
        <h2 className="text-h3 text-[--color-text-primary]">Category allocations</h2>
        <p className="text-small text-[--color-text-secondary]">
          Set a spending limit for each category. Suggested amounts shown based on typical FRC team budgets.
        </p>
        <div className="space-y-3">
          {DEFAULT_CATEGORIES.map((cat) => (
            <div key={cat.type} className="flex items-center gap-4">
              <label className="flex-1 text-sm text-[--color-text-primary]">{cat.label}</label>
              <div className="w-36">
                <Field
                  label=""
                  name={`cat_${cat.type}`}
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={getAllocation(cat.type) || cat.suggested}
                  placeholder={`$${cat.suggested}`}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-3 sticky bottom-0 bg-[--color-surface] border-t border-[--color-border] -mx-4 px-4 py-4 sm:-mx-6 sm:px-6">
        <Button type="submit" isLoading={pending}>
          {existing ? "Update budget" : "Create budget"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
      </div>
    </form>
  );
}
