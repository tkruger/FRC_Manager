"use client";

import { usePageAction } from "@/components/page-actions";
import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Dialog, DialogContent, DialogClose } from "@/components/ui/dialog";
import { orderNewItemAction } from "@/app/actions/procurement";
import { OrderSubmitted } from "./OrderSubmitted";
import { OrderDestination, destinationButton, firstDestination, type DraftOption } from "./OrderDestination";
import { useViewOnly } from "@/components/access/ViewOnly";
import { CATEGORY_OPTIONS, DEFAULT_CATEGORY } from "@/lib/inventory/categories";

const UOM_OPTS = [
  { value: "EACH", label: "Each" }, { value: "PACK", label: "Pack" }, { value: "FOOT", label: "Foot" },
  { value: "METER", label: "Meter" }, { value: "INCH", label: "Inch" }, { value: "SHEET", label: "Sheet" },
  { value: "POUND", label: "Pound" }, { value: "GALLON", label: "Gallon" }, { value: "SPOOL", label: "Spool" },
  { value: "ROLL", label: "Roll" },
];

const PRIORITY_OPTS = [
  { value: "ROUTINE",   label: "Routine" },
  { value: "URGENT",    label: "Urgent" },
  { value: "EMERGENCY", label: "Emergency" },
];

/**
 * Order something that isn't in inventory yet. Creates an empty inventory item (0 in stock) so it
 * can be tracked, and adds it to one of your order drafts (or a new one) — or sends it as an order of
 * its own. `action`: opened by that page action (the header) instead of its own button.
 */
export function OrderNewItemDialog({ variant = "outline", action, drafts = [] }: { variant?: "primary" | "outline"; action?: string; drafts?: DraftOption[] }) {
  const viewOnly = useViewOnly();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  // Remount the form on each open so a finished order doesn't stay on screen
  const [formKey, setFormKey] = useState(0);

  function close() {
    setOpen(false);
    router.refresh();
  }
  const openIt = () => { setFormKey((k) => k + 1); setOpen(true); };
  usePageAction(action, openIt);

  if (viewOnly) return null;
  return (
    <>
      {!action && (
        <Button size="sm" variant={variant} onClick={openIt}>
          + Order a new item
        </Button>
      )}
      <Dialog open={open} onOpenChange={(o) => !o && close()}>
        <DialogContent title="Order a new item" className="sm:max-w-lg">
          <NewItemForm key={formKey} onDone={close} drafts={drafts} />
        </DialogContent>
      </Dialog>
    </>
  );
}

function NewItemForm({ onDone, drafts }: { onDone: () => void; drafts: DraftOption[] }) {
  const [state, action, isPending] = useActionState(orderNewItemAction, null);
  const [name, setName] = useState("");
  const [dest, setDest] = useState(() => firstDestination(drafts));

  if (state?.success) {
    return <OrderSubmitted state={state} itemName={name} onDone={onDone} />;
  }

  return (
    <form action={action} className="space-y-4">
      <p className="text-small text-(--color-text-secondary)">
        For things not in inventory yet. This adds the item to inventory with 0 in stock and puts it on an
        order — one of your drafts, or its own. If an item with this name already exists, it&apos;s used instead.
      </p>

      {state && !state.success && (
        <div className="text-sm text-(--color-danger) bg-(--color-danger)/10 rounded px-3 py-2">{state.error}</div>
      )}

      <Field label="What do you need?" name="name" required maxLength={120}
        placeholder="e.g. NEO 550 motor" value={name} onChange={(e) => setName(e.target.value)} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Quantity" name="quantity" type="number" min="1" step="any" defaultValue={1} required />
        <Select label="Unit" name="unitOfMeasure" options={UOM_OPTS} defaultValue="EACH" />
        <Field label="Unit cost ($)" name="unitCost" type="number" min="0" step="0.01" placeholder="Optional" />
        <Select label="Category" name="category" options={[...CATEGORY_OPTIONS]} defaultValue={DEFAULT_CATEGORY} />
        <Field label="Supplier" name="preferredSupplier" placeholder="Optional, e.g. REV" />
        <Field label="Part number" name="partNumber" placeholder="Optional" />
      </div>

      <Field label="Product link" name="vendorProductUrl" type="url" placeholder="https://… (optional)" />
      <Select label="Priority" name="priority" options={PRIORITY_OPTS} defaultValue="ROUTINE" />
      <Textarea label="Why is it needed?" name="justification" rows={2} placeholder="Optional — helps whoever approves it" />
      <OrderDestination drafts={drafts} value={dest} onChange={setDest} />

      <div className="flex gap-2 pt-1">
        <Button type="submit" isLoading={isPending}>{destinationButton(dest)}</Button>
        <DialogClose asChild>
          <Button type="button" variant="outline">Cancel</Button>
        </DialogClose>
      </div>
    </form>
  );
}
