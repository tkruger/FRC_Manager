"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Dialog, DialogContent, DialogClose } from "@/components/ui/dialog";
import { orderNewItemAction } from "@/app/actions/procurement";
import { OrderSubmitted } from "./OrderSubmitted";

const CATEGORY_OPTS = [
  { value: "HARDWARE",    label: "Hardware" },
  { value: "MECHANICAL",  label: "Mechanical" },
  { value: "ELECTRICAL",  label: "Electrical" },
  { value: "ELECTRONICS", label: "Electronics" },
  { value: "SENSORS",     label: "Sensors" },
  { value: "PNEUMATICS",  label: "Pneumatics" },
  { value: "FASTENERS",   label: "Fasteners" },
  { value: "RAW_STOCK",   label: "Raw stock" },
  { value: "CONSUMABLES", label: "Consumables" },
  { value: "SAFETY",      label: "Safety" },
];

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
 * Order something that isn't in inventory yet. Creates an empty inventory item
 * (0 in stock) so it can be tracked, puts it in the order queue and submits the request.
 */
export function OrderNewItemDialog({ variant = "outline" }: { variant?: "primary" | "outline" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  // Remount the form on each open so a finished order doesn't stay on screen
  const [formKey, setFormKey] = useState(0);

  function close() {
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <Button size="sm" variant={variant} onClick={() => { setFormKey((k) => k + 1); setOpen(true); }}>
        + Order a new item
      </Button>
      <Dialog open={open} onOpenChange={(o) => !o && close()}>
        <DialogContent title="Order a new item" className="sm:max-w-lg">
          <NewItemForm key={formKey} onDone={close} />
        </DialogContent>
      </Dialog>
    </>
  );
}

function NewItemForm({ onDone }: { onDone: () => void }) {
  const [state, action, isPending] = useActionState(orderNewItemAction, null);
  const [name, setName] = useState("");

  if (state?.success) {
    return <OrderSubmitted requestId={state.requestId} stage={state.stage} itemName={name} onDone={onDone} />;
  }

  return (
    <form action={action} className="space-y-4">
      <p className="text-small text-(--color-text-secondary)">
        For things not in inventory yet. This adds the item to inventory with 0 in stock, puts it in the
        order queue and sends the order. If an item with this name already exists, it&apos;s used instead.
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
        <Select label="Category" name="category" options={CATEGORY_OPTS} defaultValue="HARDWARE" />
        <Field label="Supplier" name="preferredSupplier" placeholder="Optional, e.g. REV" />
        <Field label="Part number" name="partNumber" placeholder="Optional" />
      </div>

      <Field label="Product link" name="vendorProductUrl" type="url" placeholder="https://… (optional)" />
      <Select label="Priority" name="priority" options={PRIORITY_OPTS} defaultValue="ROUTINE" />
      <Textarea label="Why is it needed?" name="justification" rows={2} placeholder="Optional — helps whoever approves it" />

      <div className="flex gap-2 pt-1">
        <Button type="submit" isLoading={isPending}>Submit order</Button>
        <DialogClose asChild>
          <Button type="button" variant="outline">Cancel</Button>
        </DialogClose>
      </div>
    </form>
  );
}
