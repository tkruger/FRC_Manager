"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { updateToolAction } from "@/app/actions/tools";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const TYPE_OPTS = [
  { value: "POWER_TOOL",          label: "Power Tool" },
  { value: "HAND_TOOL",           label: "Hand Tool" },
  { value: "MEASUREMENT",         label: "Measurement" },
  { value: "SAFETY_EQUIPMENT",    label: "Safety Equipment" },
  { value: "ELECTRICAL_TEST",     label: "Electrical Test" },
  { value: "FABRICATION_MACHINE", label: "Fabrication Machine" },
  { value: "PRINTER_3D",          label: "3D Printer" },
  { value: "OTHER",               label: "Other" },
];

const SPACE_OPTS = [
  { value: "SHOP_ONLY",              label: "Shop only" },
  { value: "TRAVELS_TO_COMPETITION", label: "Travels to competition" },
  { value: "COMPETITION_ONLY",       label: "Competition only" },
];

const CONDITION_OPTS = [
  { value: "EXCELLENT",         label: "Excellent" },
  { value: "GOOD",              label: "Good" },
  { value: "FAIR",              label: "Fair" },
  { value: "NEEDS_REPAIR",      label: "Needs repair" },
  { value: "OUT_OF_SERVICE",    label: "Out of service" },
  { value: "OUT_FOR_MAINTENANCE", label: "Out for maintenance" },
];

interface Tool {
  id: string;
  name: string;
  toolType: string;
  space: string;
  manufacturer: string | null;
  model: string | null;
  assetTag: string | null;
  quantityOwned: number;
  homeLocation: string | null;
  condition: string;
  requiresCertification: boolean;
  certificationName: string | null;
  maintenanceIntervalDays: number | null;
  replacementCost: number | null;
  notes: string | null;
}

export function EditToolForm({ tool }: { tool: Tool }) {
  const router = useRouter();
  const boundAction = updateToolAction.bind(null, tool.id);
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

      <Field label="Tool name" name="name" required defaultValue={tool.name} />
      <div className="grid grid-cols-2 gap-4">
        <Select label="Type"  name="toolType" options={TYPE_OPTS}  defaultValue={tool.toolType} />
        <Select label="Space" name="space"    options={SPACE_OPTS} defaultValue={tool.space} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Manufacturer" name="manufacturer" defaultValue={tool.manufacturer ?? ""} />
        <Field label="Model"        name="model"        defaultValue={tool.model ?? ""} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Asset tag / serial" name="assetTag"      defaultValue={tool.assetTag ?? ""} />
        <Field label="Quantity owned"     name="quantityOwned" type="number" min="1" defaultValue={tool.quantityOwned} />
      </div>
      <Field label="Home location" name="homeLocation" defaultValue={tool.homeLocation ?? ""} />
      <Select label="Condition" name="condition" options={CONDITION_OPTS} defaultValue={tool.condition} />

      <div className="border-t border-[--color-border] pt-4 space-y-3">
        <p className="text-label font-medium text-[--color-text-secondary] uppercase tracking-wide">Certification</p>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" name="requiresCertification" defaultChecked={tool.requiresCertification} className="rounded" />
          <span className="text-sm text-[--color-text-primary]">Requires safety certification to check out</span>
        </label>
        <Field label="Certification name" name="certificationName" defaultValue={tool.certificationName ?? ""} />
      </div>

      <div className="border-t border-[--color-border] pt-4 space-y-3">
        <p className="text-label font-medium text-[--color-text-secondary] uppercase tracking-wide">Maintenance</p>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Interval (days)"     name="maintenanceIntervalDays" type="number" defaultValue={tool.maintenanceIntervalDays ?? ""} />
          <Field label="Replacement cost ($)" name="replacementCost"        type="number" step="0.01" defaultValue={tool.replacementCost ?? ""} />
        </div>
        <Textarea label="Notes" name="notes" rows={2} defaultValue={tool.notes ?? ""} />
      </div>

      <Button type="submit" isLoading={pending}>Save changes</Button>
    </form>
  );
}
