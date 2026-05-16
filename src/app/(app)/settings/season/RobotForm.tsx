"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createRobotAction } from "@/app/actions/season";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";

const ROLE_OPTIONS = [
  { value: "COMPETITION", label: "Competition Bot" },
  { value: "PRACTICE", label: "Practice Bot (Beta)" },
  { value: "DEMO", label: "Demo Bot" },
  { value: "OTHER", label: "Other" },
];

export function RobotForm({ seasonId }: { seasonId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await createRobotAction(seasonId, formData);
      if (result.success) {
        setOpen(false);
        router.refresh();
      } else {
        setError(result.error ?? "Failed to create robot.");
      }
    });
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        + Add robot
      </Button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 rounded-md border border-[--color-border] bg-[--color-surface-overlay] p-4 space-y-4">
      <p className="text-h3 text-[--color-text-primary]">Add robot</p>
      {error && (
        <div className="text-sm text-[--color-danger] bg-[--color-danger]/10 rounded px-3 py-2">{error}</div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Robot name" name="name" required placeholder="e.g. Ironclad" />
        <Select label="Role" name="role" required options={ROLE_OPTIONS} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Weight target (lbs)" name="weightTarget" type="number" placeholder="108" />
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" isLoading={isPending}>Add robot</Button>
        <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </form>
  );
}
