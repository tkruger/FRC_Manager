"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateTemplateTaskAction } from "@/app/actions/templates";
import { Dialog, DialogContent, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { SUBTEAM_OPTIONS, PRIORITY_OPTIONS } from "@/lib/schedule-helpers";
import type { TemplateTask } from "@/generated/prisma";

export function EditTaskRow({ task }: { task: TemplateTask }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await updateTemplateTaskAction(task.id, fd);
      if (result.success) { setOpen(false); router.refresh(); }
      else setError(result.error ?? "Failed.");
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="text-small text-[--color-secondary] hover:underline px-1" title="Edit task">
          Edit
        </button>
      </DialogTrigger>
      <DialogContent title={`Edit: ${task.name}`}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="text-sm text-[--color-danger] bg-[--color-danger]/10 rounded px-3 py-2">{error}</div>}

          <Field label="Task name" name="name" required defaultValue={task.name} />
          <div className="grid grid-cols-2 gap-4">
            <Select label="Sub-team" name="subTeam" placeholder="Any" options={SUBTEAM_OPTIONS} defaultValue={task.subTeam ?? ""} />
            <Select label="Priority" name="priority" options={PRIORITY_OPTIONS} defaultValue={task.priority} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Start offset (days)" name="startOffset" type="number" required defaultValue={task.startOffset}
              hint="+days from kickoff or -days from Week 0" />
            <Field label="Duration (build days)" name="durationBuildDays" type="number" min="1" required defaultValue={task.durationBuildDays} />
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" name="isMilestone" defaultChecked={task.isMilestone} className="rounded" />
              <span className="text-sm text-[--color-text-primary]">Milestone</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" name="designReviewRequired" defaultChecked={task.designReviewRequired} className="rounded" />
              <span className="text-sm text-[--color-text-primary]">Design review</span>
            </label>
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="submit" isLoading={isPending}>Save</Button>
            <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
