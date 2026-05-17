"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { addTemplateTaskAction } from "@/app/actions/templates";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { SUBTEAM_OPTIONS, PRIORITY_OPTIONS } from "@/lib/schedule-helpers";

export function AddTaskForm({ templateId }: { templateId: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  // bind(null, templateId) pre-fills the first arg so useActionState sees (_prev, formData)
  const boundAction = addTemplateTaskAction.bind(null, templateId);
  const [state, formAction, pending] = useActionState(boundAction, null);

  useEffect(() => {
    if (state?.success) {
      formRef.current?.reset();
      router.refresh();
    }
  }, [state, router]);

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      {state && !state.success && (
        <div className="text-sm text-[--color-danger] bg-[--color-danger]/10 rounded px-3 py-2">{state.error}</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Task name" name="name" required placeholder='e.g. "Intake Prototype"' className="sm:col-span-2" />
        <Select label="Sub-team" name="subTeam" placeholder="Any sub-team" options={SUBTEAM_OPTIONS} />
        <Select label="Priority" name="priority" options={PRIORITY_OPTIONS} defaultValue="MEDIUM" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Field
          label="Start offset (days)"
          name="startOffset"
          type="number"
          required
          defaultValue={0}
          hint="Positive = from kickoff, negative = from Week 0"
          className="sm:col-span-2"
        />
        <Field
          label="Duration (build days)"
          name="durationBuildDays"
          type="number"
          min="1"
          required
          defaultValue={1}
          className="sm:col-span-2"
        />
      </div>

      <div className="flex items-center gap-6">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" name="isMilestone" className="rounded" />
          <span className="text-sm text-[--color-text-primary]">Milestone ◆</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" name="designReviewRequired" className="rounded" />
          <span className="text-sm text-[--color-text-primary]">Design review required</span>
        </label>
        <Field label="Est. hours" name="estimatedHours" type="number" min="0" step="0.5" placeholder="—" className="w-28" />
      </div>

      <Button type="submit" size="sm" isLoading={pending}>Add task</Button>
    </form>
  );
}
