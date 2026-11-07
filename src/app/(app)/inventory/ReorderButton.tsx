"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Dialog, DialogContent, DialogClose } from "@/components/ui/dialog";
import { createPurchaseRequestAction } from "@/app/actions/procurement";
import { OrderSubmitted } from "./OrderSubmitted";
import { OrderDestination, destinationButton, firstDestination, type DraftOption } from "./OrderDestination";
import { useViewOnly } from "@/components/access/ViewOnly";

interface Props {
  itemId:     string;
  itemName:   string;
  reorderQty: number;
  unitCost:   number | null;
  supplier:   string | null;
  /** Your open order drafts — the item can go on one of them */
  drafts?:    DraftOption[];
}

const PRIORITY_OPTS = [
  { value: "ROUTINE",   label: "Routine" },
  { value: "URGENT",    label: "Urgent" },
  { value: "EMERGENCY", label: "Emergency" },
];

export function ReorderButton({ itemId, itemName, reorderQty, unitCost, supplier, drafts = [] }: Props) {
  const viewOnly = useViewOnly();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, action, isPending] = useActionState(createPurchaseRequestAction, null);
  const [dest, setDest] = useState(() => firstDestination(drafts));

  // Refresh only once the dialog closes: the refreshed row swaps this button for
  // an "On request" link, which would unmount the confirmation mid-read.
  function close() {
    setOpen(false);
    if (state?.success) router.refresh();
  }

  if (viewOnly) return null;
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Order
      </Button>

      <Dialog open={open} onOpenChange={(o) => !o && close()}>
        <DialogContent title={`Order: ${itemName}`} className="sm:max-w-lg">
          {state?.success ? (
            <OrderSubmitted state={state} itemName={itemName} onDone={close} />
          ) : (
            <form action={action} className="space-y-4">
              {state && !state.success && (
                <div className="text-sm text-(--color-danger) bg-(--color-danger)/10 rounded px-3 py-2">
                  {state.error}
                </div>
              )}

              <input type="hidden" name="title" value={`Reorder: ${itemName}`} />
              {/* Line item 0 — pre-filled from the inventory item */}
              <input type="hidden" name="lineItem_0_name" value={itemName} />
              <input type="hidden" name="lineItem_0_baseItemId" value={itemId} />
              {supplier && <input type="hidden" name="lineItem_0_vendorName" value={supplier} />}
              {unitCost != null && <input type="hidden" name="lineItem_0_unitCost" value={unitCost} />}

              <div className="rounded-lg border border-(--color-border) bg-(--color-surface-overlay) px-4 py-3 space-y-1">
                <p className="text-sm font-medium text-(--color-text-primary)">{itemName}</p>
                {supplier && <p className="text-small text-(--color-text-secondary)">Supplier: {supplier}</p>}
                <p className="text-small text-(--color-text-secondary)">
                  Unit cost: {unitCost != null && unitCost > 0 ? `$${unitCost.toFixed(2)}` : "—"}
                </p>
              </div>

              <Field
                label="Quantity to order"
                name="lineItem_0_quantity"
                type="number"
                min="1"
                defaultValue={reorderQty > 0 ? reorderQty : 1}
                required
              />

              <Select label="Priority" name="priority" options={PRIORITY_OPTS} defaultValue="ROUTINE" />

              <Textarea
                label="Justification"
                name="justification"
                rows={2}
                placeholder="Why is this item needed? Low stock, upcoming build session…"
              />
              <OrderDestination drafts={drafts} value={dest} onChange={setDest} />

              <div className="flex gap-2 pt-1">
                <Button type="submit" isLoading={isPending}>{destinationButton(dest)}</Button>
                <DialogClose asChild>
                  <Button type="button" variant="outline">Cancel</Button>
                </DialogClose>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
