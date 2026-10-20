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
import { TaskTimingFields, type SeasonPreview } from "./TaskTimingFields";
import { toast } from "@/components/ui/toast";

export function EditTaskRow({ task, season }: { task: TemplateTask; season: SeasonPreview | null }) {
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
      if (result.success) { toast.success("Task saved"); setOpen(false); router.refresh(); }
      else setError(result.error ?? "Failed.");
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">Edit</Button>
      </DialogTrigger>
      <DialogContent title={`Edit: ${task.name}`}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="text-sm text-[--color-danger] bg-[--color-danger]/10 rounded px-3 py-2">{error}</div>}

          <Field label="Task name" name="name" required defaultValue={task.name} />
          <div className="grid grid-cols-2 gap-4">
            <Select label="Sub-team" name="subTeam" placeholder="Any" options={SUBTEAM_OPTIONS} defaultValue={task.subTeam ?? ""} />
            <Select label="Priority" name="priority" options={PRIORITY_OPTIONS} defaultValue={task.priority} />
          </div>
          <TaskTimingFields season={season} initial={{
            anchor: task.anchor, anchorNumber: task.anchorNumber, startOffset: task.startOffset,
            durationBuildDays: task.durationBuildDays, isMilestone: task.isMilestone,
          }} />
          <div className="flex items-center gap-4">
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
