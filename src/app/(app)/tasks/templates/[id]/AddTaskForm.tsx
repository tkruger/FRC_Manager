"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { addTemplateTaskAction } from "@/app/actions/templates";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger, DialogClose, DialogFooter } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { SUBTEAM_OPTIONS, PRIORITY_OPTIONS } from "@/lib/schedule-helpers";
import { TaskTimingFields, type SeasonPreview, type TaskOption } from "./TaskTimingFields";
import { PrerequisitePicker } from "./PrerequisitePicker";
import { MarkdownEditor } from "@/components/markdown/MarkdownEditor";

/** "+ Add task" button that opens the add form in a dialog; closes once it's added */
export function AddTaskDialog({ templateId, season, taskOptions }: { templateId: string; season: SeasonPreview | null; taskOptions: TaskOption[] }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">+ Add task</Button>
      </DialogTrigger>
      <DialogContent title="Add a task or milestone" className="sm:max-w-xl">
        {/* Mounted only while open, so each add starts from an empty form */}
        {open && <AddTaskForm templateId={templateId} season={season} taskOptions={taskOptions} onAdded={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function AddTaskForm({ templateId, season, taskOptions, onAdded }: { templateId: string; season: SeasonPreview | null; taskOptions: TaskOption[]; onAdded: () => void }) {
  const router = useRouter();
  // bind(null, templateId) pre-fills the first arg so useActionState sees (_prev, formData)
  const boundAction = addTemplateTaskAction.bind(null, templateId);
  const [state, formAction, pending] = useActionState(boundAction, null);

  useEffect(() => {
    if (state?.success) {
      toast.success("Added to the template");
      router.refresh();
      onAdded();
    }
  }, [state, router, onAdded]);

  return (
    <form action={formAction} className="space-y-4">
      {state && !state.success && (
        <div className="text-sm text-[--color-danger] bg-[--color-danger]/10 rounded px-3 py-2">{state.error}</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Name" name="name" required autoFocus placeholder='e.g. "Intake Prototype"' className="sm:col-span-2" />
        <Select label="Sub-team" name="subTeam" placeholder="Any sub-team" options={SUBTEAM_OPTIONS} />
        <Select label="Priority" name="priority" options={PRIORITY_OPTIONS} defaultValue="MEDIUM" />
      </div>

      <TaskTimingFields season={season} tasks={taskOptions} />
      <PrerequisitePicker options={taskOptions} />

      <MarkdownEditor name="details" rows={4}
        hint="Copied to the task when the template is applied. Only shown when the task is opened." />

      <div className="flex flex-wrap items-end gap-6">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" name="designReviewRequired" className="rounded" />
          <span className="text-sm text-[--color-text-primary]">Design review required</span>
        </label>
        <Field label="Est. hours" name="estimatedHours" type="number" min="0" step="0.5" placeholder="—" className="w-28" />
      </div>

      <DialogFooter>
        <Button type="submit" isLoading={pending}>Add to template</Button>
        <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
      </DialogFooter>
    </form>
  );
}
