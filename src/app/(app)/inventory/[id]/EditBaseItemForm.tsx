"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { updateBaseItemAction } from "@/app/actions/inventory";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { VendorSupplierPicker } from "@/components/ui/VendorSupplierPicker";
import { toast } from "@/components/ui/toast";
import { ToolImageCapture } from "@/components/ui/ToolImageCapture";
import { UnitFields } from "../UnitFields";
import { TYPE_OPTIONS } from "@/lib/inventory/categories";
import { CategoryFields, type SubcategoryOption } from "../CategoryFields";

interface Item {
  id: string;
  name: string;
  partNumber: string | null;
  category: string;
  subcategoryId: string | null;
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
  amountLeft: string | null;
  image: string | null;
}

export function EditBaseItemForm({
  item,
  vendors = [],
  subcategories = [],
}: {
  item: Item;
  vendors?: { id: string; name: string }[];
  subcategories?: SubcategoryOption[];
}) {
  const router = useRouter();
  const boundAction = updateBaseItemAction.bind(null, item.id);
  const [state, action, pending] = useActionState(boundAction, null);

  useEffect(() => {
    if (state?.success) { toast.success("Item saved"); router.refresh(); }
  }, [state, router]);

  return (
    <form action={action} className="space-y-5">
      {state && !state.success && (
        <div className="rounded-md bg-(--color-danger)/10 border border-(--color-danger)/20 px-4 py-3 text-sm text-(--color-danger)">
          {state.error}
        </div>
      )}
      {state?.success && (
        <div className="rounded-md bg-(--color-success)/10 border border-(--color-success)/20 px-4 py-3 text-sm text-(--color-success)">
          Saved successfully.
        </div>
      )}

      <Field label="Item name" name="name" required defaultValue={item.name} />
      <div className="grid grid-cols-2 gap-4">
        <CategoryFields subcategories={subcategories} category={item.category} subcategoryId={item.subcategoryId} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Select label="Item type"    name="itemType"     options={[...TYPE_OPTIONS]} defaultValue={item.itemType} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Part number / SKU" name="partNumber"    defaultValue={item.partNumber ?? ""} />
        <UnitFields unit={item.unitOfMeasure} amountLeft={item.amountLeft} />
      </div>
      <Textarea label="Description" name="description" rows={2} defaultValue={item.description ?? ""} />
      <div id="edit-photo" className="space-y-1.5 scroll-mt-24">
        <p className="text-sm font-medium text-(--color-text-primary)">Photo</p>
        {/* Uploads straight away; saved with the item */}
        <ToolImageCapture name="imageUrl" defaultUrl={item.image} />
      </div>

      <div className="border-t border-(--color-border) pt-4 space-y-3">
        <p className="text-label font-medium text-(--color-text-secondary) uppercase tracking-wide">Stock &amp; reorder</p>
        <div className="grid grid-cols-3 gap-4">
          <Field label="Current stock"  name="currentStock"      type="number" min="0" step="0.01" defaultValue={item.currentStock} />
          <Field label="Min threshold"  name="minStockThreshold" type="number" min="0" step="0.01" defaultValue={item.minStockThreshold} hint="Triggers reorder" />
          <Field label="Reorder qty"    name="reorderQuantity"   type="number" min="0" step="0.01" defaultValue={item.reorderQuantity ?? 1} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <VendorSupplierPicker vendors={vendors} defaultValue={item.preferredSupplier} />
          <Field label="Lead time (days)"   name="supplierLeadDays"  type="number" min="0" defaultValue={item.supplierLeadDays ?? ""} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Unit cost ($)"         name="unitCost"        type="number" min="0" step="0.01" defaultValue={item.unitCost ?? ""} />
          <Field label="Fair market value ($)" name="fairMarketValue" type="number" min="0" step="0.01" defaultValue={item.fairMarketValue ?? ""} />
        </div>
        <Field label="Storage location" name="storageLocation" defaultValue={item.storageLocation ?? ""} />
      </div>

      <div className="border-t border-(--color-border) pt-4 space-y-2">
        <p className="text-label font-medium text-(--color-text-secondary) uppercase tracking-wide">FIRST</p>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" name="isKopItem" defaultChecked={item.isKopItem} className="rounded" />
          <span className="text-sm text-(--color-text-primary)">Kit of Parts (KOP) item</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" name="isFirstChoiceItem" defaultChecked={item.isFirstChoiceItem} className="rounded" />
          <span className="text-sm text-(--color-text-primary)">FIRST Choice item ($0 acquisition cost)</span>
        </label>
      </div>

      <Button type="submit" isLoading={pending}>Save changes</Button>
    </form>
  );
}
