"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { updateBaseItemAction } from "@/app/actions/inventory";
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

interface Item {
  id: string;
  name: string;
  partNumber: string | null;
  category: string;
  itemType: string;
  description: string | null;
  unitOfMeasure: string;
  currentStock: number;
  minStockThreshold: number;
  reorderQuantity: number | null;
  preferredSupplier: string | null;
  supplierLeadDays: number | null;
  unitCost: number | null;
  fairMarketValue: number | null;
  storageLocation: string | null;
  isKopItem: boolean;
  isFirstChoiceItem: boolean;
  notes: string | null;
}

export function EditBaseItemForm({ item }: { item: Item }) {
  const router = useRouter();
  const boundAction = updateBaseItemAction.bind(null, item.id);
  const [state, action, pending] = useActionState(boundAction, null);

  useEffect(() => {
    if (state?.success) router.refresh();
  }, [state, router]);

  return (
    <form action={action} className="space-y-5">
      {state && !state.success && (
        <div className="rounded-md bg-[--color-danger]/10 border border-[--color-danger]/20 px-4 py-3 text-sm text-[--color-danger]">
          {state.error}
        </div>
      )}
      {state?.success && (
        <div className="rounded-md bg-[--color-success]/10 border border-[--color-success]/20 px-4 py-3 text-sm text-[--color-success]">
          Saved successfully.
        </div>
      )}

      <Field label="Item name" name="name" required defaultValue={item.name} />
      <div className="grid grid-cols-2 gap-4">
        <Select label="Category"     name="category"     options={CATEGORY_OPTS} defaultValue={item.category} />
        <Select label="Item type"    name="itemType"     options={TYPE_OPTS}     defaultValue={item.itemType} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Part number / SKU" name="partNumber"    defaultValue={item.partNumber ?? ""} />
        <Select label="Unit of measure"  name="unitOfMeasure" options={UOM_OPTS} defaultValue={item.unitOfMeasure} />
      </div>
      <Textarea label="Description" name="description" rows={2} defaultValue={item.description ?? ""} />

      <div className="border-t border-[--color-border] pt-4 space-y-3">
        <p className="text-label font-medium text-[--color-text-secondary] uppercase tracking-wide">Stock &amp; reorder</p>
        <div className="grid grid-cols-3 gap-4">
          <Field label="Current stock"  name="currentStock"      type="number" min="0" step="0.01" defaultValue={item.currentStock} />
          <Field label="Min threshold"  name="minStockThreshold" type="number" min="0" step="0.01" defaultValue={item.minStockThreshold} hint="Triggers reorder" />
          <Field label="Reorder qty"    name="reorderQuantity"   type="number" min="0" step="0.01" defaultValue={item.reorderQuantity ?? 1} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Preferred supplier" name="preferredSupplier" defaultValue={item.preferredSupplier ?? ""} />
          <Field label="Lead time (days)"   name="supplierLeadDays"  type="number" min="0" defaultValue={item.supplierLeadDays ?? ""} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Unit cost ($)"         name="unitCost"        type="number" min="0" step="0.01" defaultValue={item.unitCost ?? ""} />
          <Field label="Fair market value ($)" name="fairMarketValue" type="number" min="0" step="0.01" defaultValue={item.fairMarketValue ?? ""} />
        </div>
        <Field label="Storage location" name="storageLocation" defaultValue={item.storageLocation ?? ""} />
      </div>

      <div className="border-t border-[--color-border] pt-4 space-y-2">
        <p className="text-label font-medium text-[--color-text-secondary] uppercase tracking-wide">FIRST</p>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" name="isKopItem" defaultChecked={item.isKopItem} className="rounded" />
          <span className="text-sm text-[--color-text-primary]">Kit of Parts (KOP) item</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" name="isFirstChoiceItem" defaultChecked={item.isFirstChoiceItem} className="rounded" />
          <span className="text-sm text-[--color-text-primary]">FIRST Choice item ($0 acquisition cost)</span>
        </label>
      </div>

      <Button type="submit" isLoading={pending}>Save changes</Button>
    </form>
  );
}
