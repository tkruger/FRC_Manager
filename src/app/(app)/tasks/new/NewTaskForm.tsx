"use client";

import { useActionState, useEffect, useRef, useState } from "react";
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
  const [selectedPrereqs,   setSelectedPrereqs]   = useState<string[]>([]);
  const [assigneeSearch,    setAssigneeSearch]     = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state?.success) router.push("/tasks");
  }, [state, router]);

  const robotOptions  = robots.map((r) => ({ value: r.id, label: r.displayName }));
  const memberMap     = Object.fromEntries(members.map((m) => [m.id, m]));
  const searchResults = assigneeSearch.trim()
    ? members.filter((m) => !selectedAssignees.includes(m.id) && m.name.toLowerCase().includes(assigneeSearch.toLowerCase()))
    : [];

  function addAssignee(id: string) {
    setSelectedAssignees((p) => [...p, id]);
    setAssigneeSearch("");
    searchRef.current?.focus();
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

      {/* Assignees — same searchable chip picker as task edit */}
      {members.length > 0 && (
        <div className="card space-y-3">
          <h2 className="text-h3 text-[--color-text-primary]">Assignees</h2>

          {/* Hidden inputs carry selected IDs */}
          {selectedAssignees.map((id) => (
            <input key={id} type="hidden" name="assigneeIds" value={id} />
          ))}

          {/* Selected chips */}
          {selectedAssignees.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selectedAssignees.map((id) => {
                const m = memberMap[id];
                if (!m) return null;
                return (
                  <span key={id}
                    className="inline-flex items-center gap-1 pl-1 pr-2 py-0.5 rounded-full bg-[--color-primary]/10 border border-[--color-primary]/25 text-sm">
                    <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                      style={{ backgroundColor: "var(--color-primary)" }}>
                      {m.name[0].toUpperCase()}
                    </span>
                    <span className="text-[--color-text-primary]">{m.name}</span>
                    <button type="button" onClick={() => setSelectedAssignees((p) => p.filter((i) => i !== id))}
                      className="ml-0.5 text-[--color-text-secondary] hover:text-[--color-danger] transition-colors leading-none">
                      ×
                    </button>
                  </span>
                );
              })}
            </div>
          )}

          {/* Search input */}
          <input
            ref={searchRef}
            type="text"
            value={assigneeSearch}
            onChange={(e) => setAssigneeSearch(e.target.value)}
            placeholder="Search team members…"
            className="w-full rounded-md border border-[--color-border] bg-[--color-surface] text-[--color-text-primary] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[--color-primary]/40 focus:border-[--color-primary]"
          />

          {/* Inline results */}
          {assigneeSearch.trim() && (
            <div className="rounded-md border border-[--color-border] overflow-hidden"
              style={{ backgroundColor: "var(--color-surface)" }}>
              {searchResults.length === 0 ? (
                <p className="px-3 py-2 text-sm text-[--color-text-secondary]">No members found</p>
              ) : (
                searchResults.map((m) => (
                  <button key={m.id} type="button" onClick={() => addAssignee(m.id)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-[--color-surface-overlay] transition-colors text-left border-b border-[--color-table-border] last:border-0">
                    <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                      style={{ backgroundColor: "var(--color-primary)" }}>
                      {m.name[0].toUpperCase()}
                    </span>
                    <span className="text-[--color-text-primary]">{m.name}</span>
                  </button>
                ))
              )}
            </div>
          )}
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

