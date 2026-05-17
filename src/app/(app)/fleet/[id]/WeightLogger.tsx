"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { logWeightSnapshotAction } from "@/app/actions/fleet";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";

export function WeightLogger({ robotId }: { robotId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const weight = parseFloat(fd.get("weight") as string);
    const notes = fd.get("notes") as string;
    if (isNaN(weight)) return;
    startTransition(async () => {
      await logWeightSnapshotAction(robotId, weight, notes || undefined);
      setOpen(false);
      router.refresh();
    });
  }

  if (!open) return (
    <button onClick={() => setOpen(true)} className="text-small text-[--color-secondary] hover:underline">
      + Log weight snapshot
    </button>
  );

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 items-end mt-1">
      <Field label="Weight (lbs)" name="weight" type="number" step="0.1" required placeholder="108.5" className="flex-1" />
      <Field label="Notes" name="notes" placeholder="Optional" className="flex-1" />
      <Button type="submit" size="sm" isLoading={isPending} className="mb-6">Save</Button>
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(false)} className="mb-6">✕</Button>
    </form>
  );
}
