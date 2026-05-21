"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createTaskAction } from "@/app/actions/tasks";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SUBTEAM_OPTIONS, STATUS_OPTIONS, PRIORITY_OPTIONS } from "@/lib/schedule-helpers";

interface Props {
  robots: { id: string; displayName: string }[];
  members: { id: string; name: string }[];
  existingTasks: { id: string; name: string; status: string }[];
  kickoffDate: string;
  week0Date: string;
}

export function NewTaskForm({ robots, members, existingTasks, kickoffDate, week0Date }: Props) {
  const router = useRouter();
  const [state, action, pending] = useActionState(createTaskAction, null);
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [selectedPrereqs, setSelectedPrereqs] = useState<string[]>([]);

  useEffect(() => {
    if (state?.success) router.push(`/tasks/${state.taskId}`);
  }, [state, router]);

  const robotOptions = robots.map((r) => ({ value: r.id, label: r.displayName }));

  function toggleAssignee(id: string) {
    setSelectedAssignees((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
  }

  function togglePrereq(id: string) {
    setSelectedPrereqs((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
  }

  return (
    <form action={action} className="space-y-6">
      {state && !state.success && (
        <div className="rounded-md bg-[--color-danger]/10 border border-[--color-danger]/20 px-4 py-3 text-sm text-[--color-danger]">
          {state.error}
        </div>
      )}

      {/* Core details */}
      <div className="card space-y-4">
        <h2 className="text-h3 text-[--color-text-primary]">Task details</h2>
        <Field label="Task name" name="name" required placeholder="e.g. Drivetrain Assembly" />
        <Textarea label="Description" name="description" rows={3} placeholder="What needs to be done, acceptance criteria, resources needed..." />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Select label="Sub-team"  name="subTeam"  placeholder="Select sub-team" options={SUBTEAM_OPTIONS} />
          <Select label="Priority"  name="priority" options={PRIORITY_OPTIONS} defaultValue="MEDIUM" />
          {robots.length > 0 && (
            <Select label="Robot" name="robotId" placeholder="Any / team-wide" options={robotOptions} />
          )}
        </div>
      </div>

      {/* Dates */}
      <div className="card space-y-4">
        <h2 className="text-h3 text-[--color-text-primary]">Schedule</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field
            label="Start date" name="startDate" type="date"
            min={kickoffDate} max={week0Date}
            hint={`Kickoff: ${kickoffDate}`}
          />
          <Field
            label="Due date" name="dueDate" type="date"
            min={kickoffDate} max={week0Date}
            hint={`Week 0: ${week0Date}`}
          />
        </div>
        <Field label="Estimated hours" name="estimatedHours" type="number" min="0" step="0.5" placeholder="e.g. 8" />
      </div>

      {/* Flags */}
      <div className="card space-y-3">
        <h2 className="text-h3 text-[--color-text-primary]">Flags</h2>
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" name="isMilestone" className="rounded w-4 h-4" />
          <div>
            <p className="text-sm font-medium text-[--color-text-primary]">Milestone</p>
            <p className="text-small text-[--color-text-secondary]">Key checkpoint shown prominently on the schedule and dashboard</p>
          </div>
        </label>
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" name="designReviewRequired" className="rounded w-4 h-4" />
          <div>
            <p className="text-sm font-medium text-[--color-text-primary]">Design review required</p>
            <p className="text-small text-[--color-text-secondary]">Task cannot complete until a formal design review is approved</p>
          </div>
        </label>
      </div>

      {/* Assignees */}
      {members.length > 0 && (
        <div className="card space-y-3">
          <h2 className="text-h3 text-[--color-text-primary]">Assignees</h2>
          <div className="max-h-48 overflow-y-auto space-y-0.5">
            {members.map((m) => {
              const active = selectedAssignees.includes(m.id);
              return (
                <label key={m.id}
                  className={`flex items-center gap-3 rounded-md px-2 py-2 cursor-pointer transition-colors ${
                    active ? "bg-[--color-primary]/10" : "hover:bg-[--color-surface-overlay]"
                  }`}>
                  <input type="checkbox" name="assigneeIds" value={m.id} checked={active}
                    onChange={() => toggleAssignee(m.id)} className="rounded flex-shrink-0" />
                  <div style={{ backgroundColor: "var(--color-primary)" }}
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                    {m.name[0].toUpperCase()}
                  </div>
                  <span className="text-sm text-[--color-text-primary]">{m.name}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* Prerequisites */}
      {existingTasks.length > 0 && (
        <div className="card space-y-3">
          <h2 className="text-h3 text-[--color-text-primary]">Prerequisites</h2>
          <p className="text-small text-[--color-text-secondary]">This task is blocked until all selected tasks are complete.</p>
          <div className="max-h-48 overflow-y-auto space-y-1">
            {existingTasks.map((t) => {
              const active = selectedPrereqs.includes(t.id);
              return (
                <label key={t.id}
                  className={`flex items-center gap-2 rounded px-2 py-1.5 cursor-pointer transition-colors ${
                    active ? "bg-[--color-primary]/8" : "hover:bg-[--color-surface-overlay]"
                  }`}>
                  <input type="checkbox" name="prerequisiteIds" value={t.id} checked={active}
                    onChange={() => togglePrereq(t.id)} className="rounded" />
                  <span className="text-sm text-[--color-text-primary]">{t.name}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* Blockers */}
      <div className="card">
        <Textarea label="Blockers / notes" name="blockersNotes" rows={2}
          placeholder="Current obstacles or context for the assignee..." />
      </div>

      {/* Footer */}
      <div className="flex gap-3 sticky bottom-0 bg-[--color-surface] border-t border-[--color-border] -mx-4 px-4 py-4 sm:-mx-6 sm:px-6">
        <Button type="submit" isLoading={pending}>Create task</Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
      </div>
    </form>
  );
}

