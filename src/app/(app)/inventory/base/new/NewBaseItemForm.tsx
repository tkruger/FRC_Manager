"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBaseItemAction } from "@/app/actions/inventory";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const CATEGORY_OPTS = [
  { value: "MECHANICAL",  label: "Mechanical" },  { value: "ELECTRICAL", label: "Electrical" },
  { value: "PNEUMATICS",  label: "Pneumatics" },  { value: "HARDWARE",   label: "Hardware" },
  { value: "FASTENERS",   label: "Fasteners" },   { value: "RAW_STOCK",  label: "Raw Stock" },
  { value: "CONSUMABLES", label: "Consumables" }, { value: "SAFETY",     label: "Safety" },
  { value: "ELECTRONICS", label: "Electronics" }, { value: "SENSORS",    label: "Sensors" },
];

const TYPE_OPTS = [
  { value: "DISCRETE",     label: "Discrete part" },
  { value: "RAW_MATERIAL", label: "Raw material (continuous)" },
  { value: "CONSUMABLE",   label: "Consumable" },
];

const UOM_OPTS = [
  { value: "EACH",   label: "Each" },  { value: "PACK",   label: "Pack" },
  { value: "FOOT",   label: "Foot" },  { value: "METER",  label: "Meter" },
  { value: "INCH",   label: "Inch" },  { value: "SHEET",  label: "Sheet" },
  { value: "POUND",  label: "Pound" }, { value: "GALLON", label: "Gallon" },
  { value: "SPOOL",  label: "Spool" }, { value: "ROLL",   label: "Roll" },
];

export function NewBaseItemForm({ onClose }: { onClose?: () => void } = {}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(createBaseItemAction, null);

  useEffect(() => {
    if (state?.success) {
      if (onClose) { onClose(); router.refresh(); }
      else router.push("/inventory");
    }
  }, [state, router, onClose]);

  return (
    <form action={action} className="space-y-5">
      {state && !state.success && (
        <div className="rounded-md bg-[--color-danger]/10 border border-[--color-danger]/20 px-4 py-3 text-sm text-[--color-danger]">{state.error}</div>
      )}

      <Field label="Item name" name="name" required placeholder='e.g. Falcon 500 Motor' />
      <div className="grid grid-cols-2 gap-4">
        <Select label="Category" name="category" options={CATEGORY_OPTS} defaultValue="MECHANICAL" />
        <Select label="Item type" name="itemType" options={TYPE_OPTS} defaultValue="DISCRETE" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Part number / SKU" name="partNumber" placeholder="Optional" />
        <Select label="Unit of measure" name="unitOfMeasure" options={UOM_OPTS} defaultValue="EACH" />
      </div>
      <Textarea label="Description" name="description" rows={2} placeholder="Optional notes about this item" />

      <div className="border-t border-[--color-border] pt-4 space-y-3">
        <p className="text-label font-medium text-[--color-text-secondary] uppercase tracking-wide">Stock & reorder</p>
        <div className="grid grid-cols-3 gap-4">
          <Field label="Current stock" name="currentStock" type="number" min="0" step="0.01" defaultValue={0} />
          <Field label="Min threshold" name="minStockThreshold" type="number" min="0" step="0.01" defaultValue={0} hint="Triggers reorder" />
          <Field label="Reorder qty" name="reorderQuantity" type="number" min="0" step="0.01" defaultValue={1} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Preferred supplier" name="preferredSupplier" placeholder="e.g. AndyMark" />
          <Field label="Lead time (days)" name="supplierLeadDays" type="number" min="0" placeholder="5" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Unit cost ($)" name="unitCost" type="number" min="0" step="0.01" placeholder="0.00" />
          <Field label="Fair market value ($)" name="fairMarketValue" type="number" min="0" step="0.01" placeholder="For BOM" />
        </div>
        <Field label="Storage location" name="storageLocation" placeholder='e.g. Shelf B3 — Red Bin' />
      </div>

      <div className="border-t border-[--color-border] pt-4 space-y-2">
        <p className="text-label font-medium text-[--color-text-secondary] uppercase tracking-wide">FIRST</p>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" name="isKopItem" className="rounded" />
          <span className="text-sm text-[--color-text-primary]">Kit of Parts (KOP) item</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" name="isFirstChoiceItem" className="rounded" />
          <span className="text-sm text-[--color-text-primary]">FIRST Choice item ($0 acquisition cost)</span>
        </label>
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="submit" isLoading={pending}>Add item</Button>
        <Button type="button" variant="outline" onClick={() => onClose ? onClose() : router.back()}>Cancel</Button>
      </div>
    </form>
  );
}
