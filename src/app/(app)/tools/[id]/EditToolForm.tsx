"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { updateToolAction } from "@/app/actions/tools";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { ToolNamePicker } from "../ToolNamePicker";

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
  homeLocation: string | null;
  condition: string;
  requiresCertification: boolean;
  certificationName: string | null;
  maintenanceIntervalDays: number | null;
  replacementCost: number | null;
  notes: string | null;
}

export function EditToolForm({ tool, names = [], groupSize = 1 }: {
  tool:       Tool;
  /** Existing tool names (groups) for the name picker */
  names?:     string[];
  /** How many tools share this tool's name (its group), itself included */
  groupSize?: number;
}) {
  const router = useRouter();
  const boundAction = updateToolAction.bind(null, tool.id);
  const [state, action, pending] = useActionState(boundAction, null);

  // Renaming a tool that shares its name: rename the whole group, or just this one?
  const formRef  = useRef<HTMLFormElement>(null);
  const scopeRef = useRef<"all" | "one" | null>(null);
  const [name, setName]   = useState(tool.name);
  const [scope, setScope] = useState<"all" | "one">("one");
  const [asking, setAsking] = useState(false);
  const promptRef = useRef<HTMLDivElement>(null);

  // The question sits by the name field, above the Save button: bring it into view
  useEffect(() => {
    if (!asking) return;
    promptRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    promptRef.current?.querySelector("button")?.focus({ preventScroll: true });
  }, [asking]);
  const renamed = name.trim() !== "" && name.trim() !== tool.name.trim();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (renamed && groupSize > 1 && !scopeRef.current) { e.preventDefault(); setAsking(true); }
  }
  function choose(next: "all" | "one") {
    scopeRef.current = next;
    setScope(next);
    setAsking(false);
    // Submit once the hidden scope field has re-rendered
    setTimeout(() => { formRef.current?.requestSubmit(); scopeRef.current = null; }, 0);
  }

  useEffect(() => {
    if (state?.success) { toast.success(state.renamed ? `Renamed ${state.renamed} tools` : "Tool saved"); router.refresh(); }
  }, [state, router]);

  return (
    <form ref={formRef} action={action} onSubmit={onSubmit} className="space-y-5">
      <input type="hidden" name="renameScope" value={scope} />
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

      <ToolNamePicker names={names} defaultValue={tool.name} onChange={setName} />
      {asking && (
        <div ref={promptRef} role="alertdialog" aria-label="Rename the group?" className="rounded-lg border border-(--color-primary)/40 bg-(--color-primary)/8 p-3 space-y-3">
          <p className="text-sm text-(--color-text-primary)">
            <b>{groupSize}</b> tools are called <b>{tool.name}</b>. Rename all of them to <b>{name.trim()}</b>, or just this one?
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={() => choose("all")}>Rename all {groupSize}</Button>
            <Button type="button" size="sm" variant="outline" onClick={() => choose("one")}>Just this one</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setAsking(false)}>Cancel</Button>
          </div>
          <p className="text-xs text-(--color-text-secondary)">Just this one moves it into its own group{name.trim() ? ` (${name.trim()})` : ""}.</p>
        </div>
      )}
      <div className="grid grid-cols-2 gap-4">
        <Select label="Type"  name="toolType" options={TYPE_OPTS}  defaultValue={tool.toolType} />
        <Select label="Space" name="space"    options={SPACE_OPTS} defaultValue={tool.space} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Manufacturer" name="manufacturer" defaultValue={tool.manufacturer ?? ""} />
        <Field label="Model"        name="model"        defaultValue={tool.model ?? ""} />
      </div>
      <Field label="Asset tag" name="assetTag" defaultValue={tool.assetTag ?? ""}
        hint="Unique to this tool. Leave blank to get the next TOOL-#### number." />
      <Field label="Home location" name="homeLocation" defaultValue={tool.homeLocation ?? ""} />
      <Select label="Condition" name="condition" options={CONDITION_OPTS} defaultValue={tool.condition} />

      <div className="border-t border-(--color-border) pt-4 space-y-3">
        <p className="text-label font-medium text-(--color-text-secondary) uppercase tracking-wide">Certification</p>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" name="requiresCertification" defaultChecked={tool.requiresCertification} className="rounded" />
          <span className="text-sm text-(--color-text-primary)">Requires safety certification to check out</span>
        </label>
        <Field label="Certification name" name="certificationName" defaultValue={tool.certificationName ?? ""} />
      </div>

      <div className="border-t border-(--color-border) pt-4 space-y-3">
        <p className="text-label font-medium text-(--color-text-secondary) uppercase tracking-wide">Maintenance</p>
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
