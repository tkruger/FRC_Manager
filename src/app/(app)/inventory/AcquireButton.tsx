"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { acquireItemAction } from "@/app/actions/inventory";
import { Dialog, DialogContent, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";

interface Props {
  itemId: string;
  itemName: string;
  robots: { id: string; displayName: string }[];
  maxQty: number;
}

const SUBSYSTEM_OPTS = [
  { value: "DRIVETRAIN", label: "Drivetrain" }, { value: "INTAKE", label: "Intake" },
  { value: "SHOOTER", label: "Shooter" },       { value: "CLIMBER", label: "Climber" },
  { value: "ELECTRICAL", label: "Electrical" }, { value: "PNEUMATICS", label: "Pneumatics" },
  { value: "FRAME", label: "Frame" },           { value: "CONTROLS", label: "Controls" },
  { value: "BUMPERS", label: "Bumpers" },       { value: "OTHER", label: "Other" },
];

export function AcquireButton({ itemId, itemName, robots, maxQty }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await acquireItemAction(itemId, fd);
      if (result.success) { setOpen(false); router.refresh(); }
      else setError(result.error ?? "Failed.");
    });
  }

  const robotOpts = robots.map((r) => ({ value: r.id, label: r.displayName }));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={maxQty <= 0}>Acquire</Button>
      </DialogTrigger>
      <DialogContent title={`Acquire: ${itemName}`}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="text-sm text-[--color-danger] bg-[--color-danger]/10 rounded px-3 py-2">{error}</div>}
          <Field label="Quantity" name="quantity" type="number" required min="1" max={maxQty} defaultValue="1"
            hint={`${maxQty} available`} />
          {robots.length > 0 && <Select label="Assign to robot" name="robotId" placeholder="No specific robot" options={robotOpts} />}
          <Select label="Subsystem" name="subsystem" placeholder="Select subsystem" options={SUBSYSTEM_OPTS} />
          <Field label="Location" name="location" placeholder='e.g. Build Table 2' />
          <div className="flex gap-2 pt-2">
            <Button type="submit" isLoading={isPending}>Move to In-Use</Button>
            <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
