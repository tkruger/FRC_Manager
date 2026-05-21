"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogClose } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { updateTaskAction, updateTaskStatusAction, deleteTaskAction } from "@/app/actions/tasks";
import { STATUS_CONFIG, PRIORITY_CONFIG, SUBTEAM_COLORS, SUBTEAM_OPTIONS, PRIORITY_OPTIONS, STATUS_OPTIONS, shortDate, isOverdue } from "@/lib/schedule-helpers";
import { formatDate } from "@/lib/utils";
import type { TaskStatus, TaskPriority, SubTeam } from "@/generated/prisma";

export interface TaskModalData {
  id: string;
  name: string;
  description: string | null;
  status: string;
  priority: string;
  subTeam: string | null;
  startDate: string | null;
  dueDate: string | null;
  estimatedHours: number | null;
  actualHours: number | null;
  isMilestone: boolean;
  designReviewRequired: boolean;
  designReviewStatus: string;
  blockersNotes: string | null;
  completionDate: string | null;
  assignees: { id: string; name: string }[];
  prerequisites: { id: string; name: string; status: string }[];
  dependents: { id: string; name: string; status: string }[];
  robot: { id: string; displayName: string } | null;
  kickoffDate?: string;
  week0Date?: string;
}

interface Props {
  task: TaskModalData | null;
  allTasks?: { id: string; name: string; status: string }[];
  allMembers?: { id: string; name: string }[];
  allRobots?: { id: string; displayName: string }[];
  kickoffDate?: string;
  week0Date?: string;
  onClose: () => void;
  onUpdated?: () => void;
}

export function TaskModal({ task, allTasks = [], allMembers = [], allRobots = [], kickoffDate, week0Date, onClose, onUpdated }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [localStatus, setLocalStatus] = useState(task?.status ?? "NOT_STARTED");

  if (!task) return null;

  const statusCfg   = STATUS_CONFIG[task.status as TaskStatus];
  const priorityCfg = PRIORITY_CONFIG[task.priority as TaskPriority];
  const stColor     = SUBTEAM_COLORS[task.subTeam ?? ""] ?? "#64748B";
  const overdue     = isOverdue({ dueDate: task.dueDate ? new Date(task.dueDate) : null, status: task.status as TaskStatus });

  function handleStatusChange(newStatus: string) {
    if (!task) return;
    setLocalStatus(newStatus);
    startTransition(async () => {
      await updateTaskStatusAction(task.id, newStatus as TaskStatus);
      onUpdated?.();
      router.refresh();
    });
  }

  function handleDelete() {
    if (!task) return;
    if (!confirm("Delete this task? This cannot be undone.")) return;
    startTransition(async () => {
      await deleteTaskAction(task.id);
      onClose();
      router.refresh();
    });
  }

  const robotOptions = allRobots.map((r) => ({ value: r.id, label: r.displayName }));
  const toDateVal = (d: string | null) => d ? new Date(d).toISOString().split("T")[0] : "";

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={task.name} className="sm:max-w-2xl">
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">

          {!editing ? (
            <>
              {/* Badges row */}
              <div className="flex flex-wrap gap-2">
                <Badge variant={statusCfg?.variant ?? "neutral"}>{statusCfg?.label ?? task.status}</Badge>
                <Badge variant={priorityCfg?.variant ?? "neutral"}>{priorityCfg?.label ?? task.priority}</Badge>
                {task.subTeam && <span className="badge badge-neutral" style={{ color: stColor }}>{task.subTeam.replace(/_/g, " ")}</span>}
                {task.isMilestone && <Badge variant="info">◆ Milestone</Badge>}
                {overdue && <Badge variant="danger">Overdue</Badge>}
              </div>

              {/* Status quick-change */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-[--color-surface-overlay]">
                <span className="text-small text-[--color-text-secondary]">Status</span>
                <select
                  value={localStatus}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  disabled={isPending}
                  className="text-sm font-medium bg-transparent border-none focus:outline-none cursor-pointer text-[--color-text-primary]"
                >
                  {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>

              {/* Dates + hours */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Start",      value: shortDate(task.startDate ? new Date(task.startDate) : null) },
                  { label: "Due",        value: shortDate(task.dueDate   ? new Date(task.dueDate)   : null) },
                  { label: "Est. hours", value: task.estimatedHours != null ? `${task.estimatedHours}h` : "—" },
                  { label: "Actual",     value: task.actualHours    != null ? `${task.actualHours}h`    : "—" },
                ].map((m) => (
                  <div key={m.label} className="rounded-md bg-[--color-surface-overlay] px-3 py-2">
                    <p className="text-label text-[--color-text-secondary]">{m.label}</p>
                    <p className="text-sm font-medium text-[--color-text-primary] mt-0.5">{m.value}</p>
                  </div>
                ))}
              </div>

              {/* Description */}
              {task.description && (
                <div>
                  <p className="text-label text-[--color-text-secondary] mb-1">Description</p>
                  <p className="text-sm text-[--color-text-primary] whitespace-pre-wrap">{task.description}</p>
                </div>
              )}

              {/* Blockers */}
              {task.blockersNotes && (
                <div className="rounded-md bg-[--color-danger]/8 border border-[--color-danger]/20 px-3 py-2">
                  <p className="text-label text-[--color-danger] mb-0.5">Blockers</p>
                  <p className="text-sm text-[--color-text-primary]">{task.blockersNotes}</p>
                </div>
              )}

              {/* Assignees */}
              {task.assignees.length > 0 && (
                <div>
                  <p className="text-label text-[--color-text-secondary] mb-2">Assignees</p>
                  <div className="flex flex-wrap gap-2">
                    {task.assignees.map((a) => (
                      <span key={a.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[--color-surface-overlay] text-sm text-[--color-text-primary]">
                        <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white"
                          style={{ backgroundColor: "var(--color-primary)" }}>
                          {a.name[0].toUpperCase()}
                        </span>
                        {a.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Dependencies */}
              {(task.prerequisites.length > 0 || task.dependents.length > 0) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {task.prerequisites.length > 0 && (
                    <div>
                      <p className="text-label text-[--color-text-secondary] mb-2">Prerequisites</p>
                      <div className="space-y-1">
                        {task.prerequisites.map((p) => {
                          const cfg = STATUS_CONFIG[p.status as TaskStatus];
                          return (
                            <div key={p.id} className="flex items-center justify-between text-sm">
                              <span className="text-[--color-text-primary] truncate">{p.name}</span>
                              <Badge variant={cfg?.variant ?? "neutral"} className="ml-2 shrink-0">{cfg?.label ?? p.status}</Badge>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {task.dependents.length > 0 && (
                    <div>
                      <p className="text-label text-[--color-text-secondary] mb-2">Unlocks</p>
                      <div className="space-y-1">
                        {task.dependents.map((d) => {
                          const cfg = STATUS_CONFIG[d.status as TaskStatus];
                          return (
                            <div key={d.id} className="flex items-center justify-between text-sm">
                              <span className="text-[--color-text-primary] truncate">{d.name}</span>
                              <Badge variant={cfg?.variant ?? "neutral"} className="ml-2 shrink-0">{cfg?.label ?? d.status}</Badge>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Design review */}
              {task.designReviewRequired && (
                <div className="rounded-md bg-[--color-surface-overlay] px-3 py-2">
                  <p className="text-label text-[--color-text-secondary]">Design review</p>
                  <p className="text-sm font-medium text-[--color-text-primary] mt-0.5">
                    {task.designReviewStatus.replace(/_/g, " ")}
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-2 border-t border-[--color-border]">
                <Button size="sm" onClick={() => setEditing(true)}>Edit task</Button>
                <Button variant="danger" size="sm" onClick={handleDelete} isLoading={isPending}>Delete</Button>
                <DialogClose asChild>
                  <Button variant="outline" size="sm">Close</Button>
                </DialogClose>
              </div>
            </>
          ) : (
            <EditTaskForm
              task={task}
              allTasks={allTasks}
              allMembers={allMembers}
              allRobots={allRobots}
              kickoffDate={kickoffDate}
              week0Date={week0Date}
              onCancel={() => setEditing(false)}
              onSaved={() => { setEditing(false); onUpdated?.(); router.refresh(); }}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Inline edit form inside the modal ────────────────────────────────────────

function EditTaskForm({ task, allTasks, allMembers, allRobots, kickoffDate, week0Date, onCancel, onSaved }: {
  task: TaskModalData;
  allTasks: { id: string; name: string; status: string }[];
  allMembers: { id: string; name: string }[];
  allRobots: { id: string; displayName: string }[];
  kickoffDate?: string;
  week0Date?: string;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [selectedAssignees, setSelectedAssignees] = useState(task.assignees.map((a) => a.id));
  const [selectedPrereqs,   setSelectedPrereqs]   = useState(task.prerequisites.map((p) => p.id));
  const [assigneeSearch,    setAssigneeSearch]     = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const boundAction = updateTaskAction.bind(null, task.id);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await boundAction(null, fd);
      if (result.success) onSaved();
      else setError(result.error ?? "Save failed.");
    });
  }

  const toDateVal = (d: string | null) => d ? new Date(d).toISOString().split("T")[0] : "";
  const robotOptions = allRobots.map((r) => ({ value: r.id, label: r.displayName }));

  // Assignee search helpers
  const assigneeMap = Object.fromEntries(allMembers.map((m) => [m.id, m]));
  const searchResults = assigneeSearch.trim()
    ? allMembers.filter(
        (m) =>
          !selectedAssignees.includes(m.id) &&
          m.name.toLowerCase().includes(assigneeSearch.toLowerCase())
      )
    : [];

  function addAssignee(id: string) {
    setSelectedAssignees((p) => [...p, id]);
    setAssigneeSearch("");
    searchRef.current?.focus();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="text-sm text-[--color-danger] bg-[--color-danger]/10 rounded px-3 py-2">{error}</div>}
      <Field label="Task name" name="name" required defaultValue={task.name} />
      <Textarea label="Description" name="description" rows={3} defaultValue={task.description ?? ""} />

      <div className="grid grid-cols-2 gap-4">
        <Select label="Status" name="status" options={STATUS_OPTIONS} defaultValue={task.status} />
        <Select label="Priority" name="priority" options={PRIORITY_OPTIONS} defaultValue={task.priority} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Select label="Sub-team" name="subTeam" placeholder="Any" options={SUBTEAM_OPTIONS} defaultValue={task.subTeam ?? ""} />
        {allRobots.length > 0 && (
          <Select label="Robot" name="robotId" placeholder="Any / team-wide" options={robotOptions} defaultValue={task.robot?.id ?? ""} />
        )}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Start date" name="startDate" type="date" min={kickoffDate} max={week0Date} defaultValue={toDateVal(task.startDate)} />
        <Field label="Due date"   name="dueDate"   type="date" min={kickoffDate} max={week0Date} defaultValue={toDateVal(task.dueDate)} />
      </div>
      <Field label="Estimated hours" name="estimatedHours" type="number" min="0" step="0.5" defaultValue={task.estimatedHours ?? ""} />
      <div className="space-y-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" name="isMilestone" defaultChecked={task.isMilestone} className="rounded" />
          <span className="text-sm text-[--color-text-primary]">Milestone</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" name="designReviewRequired" defaultChecked={task.designReviewRequired} className="rounded" />
          <span className="text-sm text-[--color-text-primary]">Design review required</span>
        </label>
      </div>

      {/* Assignees — searchable picker */}
      {allMembers.length > 0 && (
        <div>
          <p className="text-label font-medium text-[--color-text-primary] mb-2">Assignees</p>

          {/* Hidden inputs carry selected IDs to the form */}
          {selectedAssignees.map((id) => (
            <input key={id} type="hidden" name="assigneeIds" value={id} />
          ))}

          {/* Selected chips */}
          {selectedAssignees.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {selectedAssignees.map((id) => {
                const m = assigneeMap[id];
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
          <div className="relative">
            <input
              ref={searchRef}
              type="text"
              value={assigneeSearch}
              onChange={(e) => setAssigneeSearch(e.target.value)}
              placeholder="Search team members…"
              className="w-full rounded-md border border-[--color-border] bg-[--color-surface] text-[--color-text-primary] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[--color-primary]/40 focus:border-[--color-primary]"
            />
            {searchResults.length > 0 && (
              <div
                className="absolute z-50 top-full mt-1 w-full rounded-md border border-[--color-border] max-h-40 overflow-y-auto"
                style={{ backgroundColor: "var(--color-surface)", boxShadow: "var(--shadow-lg)" }}
              >
                {searchResults.map((m) => (
                  <button key={m.id} type="button" onClick={() => addAssignee(m.id)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-[--color-surface-overlay] transition-colors text-left">
                    <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                      style={{ backgroundColor: "var(--color-primary)" }}>
                      {m.name[0].toUpperCase()}
                    </span>
                    <span className="text-[--color-text-primary]">{m.name}</span>
                  </button>
                ))}
              </div>
            )}
            {assigneeSearch.trim() && searchResults.length === 0 && (
              <div
                className="absolute z-50 top-full mt-1 w-full rounded-md border border-[--color-border] px-3 py-2 text-sm text-[--color-text-secondary]"
                style={{ backgroundColor: "var(--color-surface)" }}
              >
                No members found
              </div>
            )}
          </div>
        </div>
      )}

      {/* Prerequisites */}
      {allTasks.length > 0 && (
        <div>
          <p className="text-label font-medium text-[--color-text-primary] mb-2">Prerequisites</p>
          <div className="max-h-36 overflow-y-auto space-y-0.5 rounded-md border border-[--color-border] p-2">
            {allTasks.filter((t) => t.id !== task.id).map((t) => (
              <label key={t.id} className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-sm ${selectedPrereqs.includes(t.id) ? "bg-[--color-primary]/10" : "hover:bg-[--color-surface-overlay]"}`}>
                <input type="checkbox" name="prerequisiteIds" value={t.id} checked={selectedPrereqs.includes(t.id)}
                  onChange={(e) => setSelectedPrereqs(p => e.target.checked ? [...p, t.id] : p.filter(id => id !== t.id))} className="rounded" />
                <span className="text-[--color-text-primary] truncate">{t.name}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      <Textarea label="Blockers / notes" name="blockersNotes" rows={2} defaultValue={task.blockersNotes ?? ""} />

      <div className="flex gap-2">
        <Button type="submit" isLoading={isPending}>Save changes</Button>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}
