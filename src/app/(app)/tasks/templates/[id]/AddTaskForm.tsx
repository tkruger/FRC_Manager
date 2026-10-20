"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { addTemplateTaskAction } from "@/app/actions/templates";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { SUBTEAM_OPTIONS, PRIORITY_OPTIONS } from "@/lib/schedule-helpers";
import { TaskTimingFields, type SeasonPreview } from "./TaskTimingFields";

export function AddTaskForm({ templateId, season }: { templateId: string; season: SeasonPreview | null }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  // bind(null, templateId) pre-fills the first arg so useActionState sees (_prev, formData)
  const boundAction = addTemplateTaskAction.bind(null, templateId);
  const [state, formAction, pending] = useActionState(boundAction, null);
  // Bumped after each add so the (controlled) timing fields reset with the form
  const [timingKey, setTimingKey] = useState(0);

  useEffect(() => {
    if (state?.success) {
      formRef.current?.reset();
      setTimingKey((k) => k + 1); // eslint-disable-line react-hooks/set-state-in-effect
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

      <TaskTimingFields key={timingKey} season={season} />

      <div className="flex flex-wrap items-end gap-6">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" name="designReviewRequired" className="rounded" />
          <span className="text-sm text-[--color-text-primary]">Design review required</span>
        </label>
        <Field label="Est. hours" name="estimatedHours" type="number" min="0" step="0.5" placeholder="—" className="w-28" />
      </div>

      <Button type="submit" size="sm" isLoading={pending}>Add to template</Button>
    </form>
  );
}
