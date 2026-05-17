"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createToolAction } from "@/app/actions/tools";
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
  { value: "SHOP_ONLY",             label: "Shop only" },
  { value: "TRAVELS_TO_COMPETITION",label: "Travels to competition" },
  { value: "COMPETITION_ONLY",      label: "Competition only" },
];

const CONDITION_OPTS = [
  { value: "EXCELLENT", label: "Excellent" },
  { value: "GOOD",      label: "Good" },
  { value: "FAIR",      label: "Fair" },
];

export function NewToolForm() {
  const router = useRouter();
  const [state, action, pending] = useActionState(createToolAction, null);

  useEffect(() => {
    if (state?.success) router.push("/tools");
  }, [state, router]);

  return (
    <form action={action} className="space-y-6">
      {state && !state.success && (
        <div className="rounded-md bg-[--color-danger]/10 border border-[--color-danger]/20 px-4 py-3 text-sm text-[--color-danger]">{state.error}</div>
      )}
      <div className="card space-y-4">
        <Field label="Tool name" name="name" required placeholder='e.g. Cordless Drill — DeWalt 20V #3' />
        <div className="grid grid-cols-2 gap-4">
          <Select label="Type" name="toolType" options={TYPE_OPTS} defaultValue="OTHER" />
          <Select label="Space" name="space" options={SPACE_OPTS} defaultValue="SHOP_ONLY" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Manufacturer" name="manufacturer" placeholder="DeWalt" />
          <Field label="Model" name="model" placeholder="DCD791D2" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Asset tag / serial" name="assetTag" placeholder="TOOL-001" />
          <Field label="Quantity owned" name="quantityOwned" type="number" min="1" defaultValue={1} />
        </div>
        <Field label="Home location" name="homeLocation" placeholder='e.g. Red Toolbox — Top Drawer' />
        <Select label="Condition" name="condition" options={CONDITION_OPTS} defaultValue="GOOD" />
      </div>
      <div className="card space-y-4">
        <h2 className="text-h3 text-[--color-text-primary]">Certification</h2>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" name="requiresCertification" className="rounded" />
          <span className="text-sm text-[--color-text-primary]">Requires safety certification to check out</span>
        </label>
        <Field label="Certification name" name="certificationName" placeholder='e.g. Drill Press Safety' />
      </div>
      <div className="card space-y-4">
        <h2 className="text-h3 text-[--color-text-primary]">Maintenance</h2>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Maintenance interval (days)" name="maintenanceIntervalDays" type="number" placeholder="90" />
          <Field label="Replacement cost ($)" name="replacementCost" type="number" step="0.01" placeholder="0.00" />
        </div>
        <Textarea label="Notes" name="notes" rows={2} placeholder="Special instructions, quirks, use guidelines..." />
      </div>
      <div className="flex gap-3">
        <Button type="submit" isLoading={pending}>Add tool</Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
      </div>
    </form>
  );
}
