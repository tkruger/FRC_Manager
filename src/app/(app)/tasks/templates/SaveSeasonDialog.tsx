"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveSeasonAsTemplateAction } from "@/app/actions/templates";
import { Dialog, DialogContent, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";

export function SaveSeasonDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const name = fd.get("name") as string;
    const description = fd.get("description") as string;
    startTransition(async () => {
      const result = await saveSeasonAsTemplateAction(name, description);
      if (result.success) {
        setOpen(false);
        if (result.id) router.push(`/schedule/templates/${result.id}`);
        else router.refresh();
      } else {
        setError(result.error ?? "Failed.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">Save season as template</Button>
      </DialogTrigger>
      <DialogContent title="Save season as template" description="All current season tasks will be saved with relative date offsets.">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="text-sm text-[--color-danger] bg-[--color-danger]/10 rounded px-3 py-2">{error}</div>}
          <Field label="Template name" name="name" required placeholder='e.g. "2026 Build Season"' />
          <Textarea label="Description" name="description" rows={2} placeholder="Optional notes about this template" />
          <div className="flex gap-2 pt-2">
            <Button type="submit" isLoading={isPending}>Save template</Button>
            <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

