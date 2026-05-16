"use client";

import { useActionState, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createPurchaseRequestAction } from "@/app/actions/procurement";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/utils";
import { SUBTEAM_OPTIONS, BUDGET_CATEGORY_OPTIONS } from "@/lib/procurement-helpers";
import { Trash2, Plus } from "lucide-react";

interface LineItem {
  name: string;
  partNumber: string;
  vendorProductUrl: string;
  quantity: string;
  unitCost: string;
  goesOnRobotBom: boolean;
}

const EMPTY_LINE: LineItem = { name: "", partNumber: "", vendorProductUrl: "", quantity: "1", unitCost: "", goesOnRobotBom: false };

export function NewRequestForm({ vendors }: { vendors: { id: string; name: string; preferred: boolean }[] }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(createPurchaseRequestAction, null);
  const [lines, setLines] = useState<LineItem[]>([{ ...EMPTY_LINE }]);

  useEffect(() => {
    if (state?.success) router.push(`/procurement/requests/${state.requestId}`);
  }, [state, router]);

  const estimatedTotal = lines.reduce((sum, l) => {
    const qty = parseFloat(l.quantity) || 0;
    const cost = parseFloat(l.unitCost) || 0;
    return sum + qty * cost;
  }, 0);

  function updateLine(i: number, field: keyof LineItem, value: string | boolean) {
    setLines((prev) => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l));
  }

  function addLine() { setLines((prev) => [...prev, { ...EMPTY_LINE }]); }
  function removeLine(i: number) { setLines((prev) => prev.filter((_, idx) => idx !== i)); }

  const vendorOptions = vendors.map((v) => ({ value: v.id, label: v.preferred ? `★ ${v.name}` : v.name }));

  return (
    <form action={action} className="space-y-6">
      {state && !state.success && (
        <div className="rounded-md bg-[--color-danger]/10 border border-[--color-danger]/20 px-4 py-3 text-sm text-[--color-danger]">
          {state.error}
        </div>
      )}

      {/* Request details */}
      <div className="card space-y-4">
        <h2 className="text-h3 text-[--color-text-primary]">Request details</h2>
        <Field label="Request title" name="title" required placeholder="e.g. Drivetrain motors for Week 3" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Select label="Sub-team" name="subTeam" placeholder="Select sub-team" options={SUBTEAM_OPTIONS} />
          <Select
            label="Priority"
            name="priority"
            options={[
              { value: "ROUTINE", label: "Routine" },
              { value: "URGENT", label: "Urgent" },
              { value: "EMERGENCY", label: "🚨 Emergency" },
            ]}
            defaultValue="ROUTINE"
          />
          <Select
            label="Preferred vendor"
            name="preferredVendorId"
            placeholder="Any vendor"
            options={vendorOptions}
          />
        </div>
        <Select label="Budget category" name="budgetCategory" placeholder="Select category" options={BUDGET_CATEGORY_OPTIONS} />
        <Textarea label="Justification" name="justification" rows={2} placeholder="Why is this needed? What build task does it support?" />
      </div>

      {/* Line items */}
      <div className="card space-y-4">
        <h2 className="text-h3 text-[--color-text-primary]">Line items</h2>

        {lines.map((line, i) => (
          <div key={i} className="rounded-md border border-[--color-border] bg-[--color-surface] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-label text-[--color-text-secondary]">Item {i + 1}</span>
              {lines.length > 1 && (
                <button type="button" onClick={() => removeLine(i)} className="text-[--color-text-disabled] hover:text-[--color-danger] transition-colors">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Hidden fields so the server action can read them */}
            <input type="hidden" name={`lineItem_${i}_goesOnRobotBom`} value={line.goesOnRobotBom ? "on" : "off"} />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field
                label="Item name" required
                name={`lineItem_${i}_name`}
                value={line.name}
                onChange={(e) => updateLine(i, "name", e.target.value)}
                placeholder="e.g. Falcon 500 Motor"
              />
              <Field
                label="Part number"
                name={`lineItem_${i}_partNumber`}
                value={line.partNumber}
                onChange={(e) => updateLine(i, "partNumber", e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Field
                label="Qty" required type="number" min="1"
                name={`lineItem_${i}_quantity`}
                value={line.quantity}
                onChange={(e) => updateLine(i, "quantity", e.target.value)}
              />
              <Field
                label="Unit cost ($)" type="number" min="0" step="0.01"
                name={`lineItem_${i}_unitCost`}
                value={line.unitCost}
                onChange={(e) => updateLine(i, "unitCost", e.target.value)}
                placeholder="0.00"
              />
              <div className="col-span-2">
                <Field
                  label="Product URL"
                  name={`lineItem_${i}_vendorProductUrl`}
                  value={line.vendorProductUrl}
                  onChange={(e) => updateLine(i, "vendorProductUrl", e.target.value)}
                  placeholder="https://..."
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id={`bom_${i}`}
                checked={line.goesOnRobotBom}
                onChange={(e) => updateLine(i, "goesOnRobotBom", e.target.checked)}
                className="rounded"
              />
              <label htmlFor={`bom_${i}`} className="text-sm text-[--color-text-primary]">Goes on robot BOM</label>
            </div>
          </div>
        ))}

        <button type="button" onClick={addLine}
          className="flex items-center gap-1.5 text-sm text-[--color-secondary] hover:underline">
          <Plus className="h-4 w-4" /> Add another item
        </button>

        {/* Estimated total */}
        <div className="flex justify-end pt-2 border-t border-[--color-border]">
          <div className="text-right">
            <p className="text-label text-[--color-text-secondary]">Estimated total</p>
            <p className="text-h2 text-[--color-text-primary]">{formatCurrency(estimatedTotal)}</p>
            {estimatedTotal > 0 && estimatedTotal <= 50 && (
              <p className="text-small text-[--color-success]">Will be auto-approved (under $50)</p>
            )}
          </div>
        </div>
      </div>

      {/* Footer actions */}
      <div className="flex gap-3 sticky bottom-0 bg-[--color-surface] border-t border-[--color-border] -mx-4 px-4 py-4 sm:-mx-6 sm:px-6">
        <Button type="submit" isLoading={pending}>Submit request</Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
      </div>
    </form>
  );
}
