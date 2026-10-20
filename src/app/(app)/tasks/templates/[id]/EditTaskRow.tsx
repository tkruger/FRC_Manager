"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateTemplateTaskAction, addTemplateTaskAction } from "@/app/actions/templates";
import { Dialog, DialogContent, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { SUBTEAM_OPTIONS, PRIORITY_OPTIONS } from "@/lib/schedule-helpers";
import type { TemplateTask } from "@/generated/prisma";
import { TaskTimingFields, type SeasonPreview } from "./TaskTimingFields";
import { toast } from "@/components/ui/toast";

/**
 * Edit a template task or milestone — or, with `clone`, start a new one from a copy of it:
 * same form, prefilled ("… (copy)"), saved as a new item; the original isn't touched.
 */
export function EditTaskRow({ task, season, clone = false }: { task: TemplateTask; season: SeasonPreview | null; clone?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = clone ? await addTemplateTaskAction(task.templateId, null, fd) : await updateTemplateTaskAction(task.id, fd);
      if (result.success) { toast.success(clone ? `Copy of ${task.name} added` : "Saved"); setOpen(false); router.refresh(); }
      else setError(result.error ?? "Failed.");
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {clone
          ? <Button variant="outline" size="sm" title={`Make a copy of ${task.name}`}>Clone</Button>
          : <Button variant="outline" size="sm">Edit</Button>}
      </DialogTrigger>
      <DialogContent title={clone ? `Clone: ${task.name}` : `Edit: ${task.name}`}
        description={clone ? "Change what's different and save — it's added as a new item. The original stays as it is." : undefined}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="text-sm text-(--color-danger) bg-(--color-danger)/10 rounded px-3 py-2">{error}</div>}

          <Field label={task.isMilestone ? "Milestone name" : "Task name"} name="name" required defaultValue={clone ? `${task.name} (copy)` : task.name} autoFocus={clone} />
          {/* A copy keeps what the form doesn't show */}
          {clone && <>
            <input type="hidden" name="description" value={task.description ?? ""} />
            <input type="hidden" name="prerequisiteNames" value={task.prerequisiteNames.join("|")} />
            {task.estimatedHours != null && <input type="hidden" name="estimatedHours" value={task.estimatedHours} />}
          </>}
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
            <Button type="submit" isLoading={isPending}>{clone ? "Add copy" : "Save"}</Button>
            <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
