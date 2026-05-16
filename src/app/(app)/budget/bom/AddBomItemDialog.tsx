"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addBomItemAction } from "@/app/actions/bom";
import { Dialog, DialogContent, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";

const SOURCE_OPTIONS = [
  { value: "DIRECT",        label: "Purchased directly" },
  { value: "KOP",           label: "Kit of Parts (KOP)" },
  { value: "FIRST_CHOICE",  label: "FIRST Choice" },
  { value: "DONATED",       label: "Donated" },
  { value: "BASE_INVENTORY", label: "From base inventory" },
];

const SUBSYSTEM_OPTIONS = [
  { value: "DRIVETRAIN", label: "Drivetrain" },
  { value: "INTAKE",     label: "Intake" },
  { value: "SHOOTER",    label: "Shooter" },
  { value: "CLIMBER",    label: "Climber" },
  { value: "ELECTRICAL", label: "Electrical" },
  { value: "PNEUMATICS", label: "Pneumatics" },
  { value: "FRAME",      label: "Frame" },
  { value: "CONTROLS",   label: "Controls" },
  { value: "BUMPERS",    label: "Bumpers" },
  { value: "OTHER",      label: "Other" },
];

export function AddBomItemDialog({ robotId }: { robotId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [source, setSource] = useState("DIRECT");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await addBomItemAction(robotId, fd);
      if (result.success) { setOpen(false); router.refresh(); }
      else setError(result.error ?? "Failed.");
    });
  }

  const isKop = source === "KOP";
  const isFirstChoice = source === "FIRST_CHOICE";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">+ Add BOM item</Button>
      </DialogTrigger>
      <DialogContent title="Add BOM item" className="max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="text-sm text-[--color-danger] bg-[--color-danger]/10 rounded px-3 py-2">{error}</div>}

          <div className="grid grid-cols-2 gap-4">
            <Field label="Part name" name="partName" required placeholder="e.g. Falcon 500" className="col-span-2" />
            <Field label="Part number" name="partNumber" placeholder="Optional" />
            <Field label="Quantity" name="quantity" type="number" required min="1" defaultValue="1" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Source"
              name="source"
              options={SOURCE_OPTIONS}
              value={source}
              onChange={(e) => setSource(e.target.value)}
            />
            <Select label="Subsystem" name="subsystem" placeholder="Select subsystem" options={SUBSYSTEM_OPTIONS} />
          </div>

          <Field
            label="Unit FMV ($)"
            name="unitFmv"
            type="number"
            step="0.01"
            min="0"
            placeholder="Fair market value per unit"
            hint="Required for cost cap tracking. Items under $5 each are automatically exempted."
          />

          {isKop && (
            <div className="flex items-center gap-2 rounded-md bg-[--color-info]/10 px-3 py-2">
              <input type="checkbox" name="exemptKop" id="exemptKop" defaultChecked />
              <label htmlFor="exemptKop" className="text-sm text-[--color-text-primary]">
                KOP exempt — counts as $0 toward the $5,000 cap
              </label>
            </div>
          )}
          {isFirstChoice && (
            <div className="flex items-center gap-2 rounded-md bg-[--color-success]/10 px-3 py-2">
              <input type="checkbox" name="exemptFirstChoice" id="exemptFC" defaultChecked />
              <label htmlFor="exemptFC" className="text-sm text-[--color-text-primary]">
                FIRST Choice exempt — $0 acquisition cost
              </label>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button type="submit" isLoading={isPending}>Add item</Button>
            <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
