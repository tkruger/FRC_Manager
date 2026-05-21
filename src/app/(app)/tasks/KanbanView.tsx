"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { updateTaskStatusAction } from "@/app/actions/tasks";
import {
  STATUS_CONFIG,
  PRIORITY_CONFIG,
  SUBTEAM_COLORS,
  SUBTEAM_OPTIONS,
  shortDate,
  isOverdue,
} from "@/lib/schedule-helpers";
import { TaskModal } from "./TaskModal";
import type { TaskModalData } from "./TaskModal";
import type { TaskStatus } from "@/generated/prisma";

interface KanbanTask extends TaskModalData {}

interface Props {
  tasks:       KanbanTask[];
  allTasks:    { id: string; name: string; status: string }[];
  allMembers:  { id: string; name: string }[];
  allRobots:   { id: string; displayName: string }[];
  kickoffDate?: string;
  week0Date?:  string;
  canEdit:     boolean;
}

interface Column {
  id:          string;
  label:       string;
  accent:      string;
  dropTarget:  boolean;
}

const now = new Date().toISOString();

const COLUMNS: Column[] = [
  { id: "FUTURE",      label: "Future",      accent: "#7C3AED", dropTarget: false },
  { id: "NOT_STARTED", label: "Not Started", accent: "#64748B", dropTarget: true  },
  { id: "IN_PROGRESS", label: "In Progress", accent: "#1D3A8A", dropTarget: true  },
  { id: "BLOCKED",     label: "Blocked",     accent: "#C1121F", dropTarget: true  },
  { id: "IN_REVIEW",   label: "In Review",   accent: "#B45309", dropTarget: true  },
  { id: "COMPLETE",    label: "Complete",    accent: "#1A7F4B", dropTarget: true  },
];

function getColTasks(tasks: KanbanTask[], colId: string, statuses: Record<string, string>) {
  const s = (t: KanbanTask) => statuses[t.id] ?? t.status;
  if (colId === "FUTURE")      return tasks.filter((t) => !!t.startDate && t.startDate > now && s(t) === "NOT_STARTED");
  if (colId === "NOT_STARTED") return tasks.filter((t) => s(t) === "NOT_STARTED" && (!t.startDate || t.startDate <= now));
  return tasks.filter((t) => s(t) === colId);
}

export function KanbanView({
  tasks, allTasks, allMembers, allRobots, kickoffDate, week0Date, canEdit,
}: Props) {
  const router = useRouter();
  const [, startTransition]   = useTransition();
  const [selectedTask,   setSelectedTask]   = useState<KanbanTask | null>(null);
  const [filterSubteam,  setFilterSubteam]  = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [filterAssignee, setFilterAssignee] = useState("");
  // DnD state
  const [draggingId,    setDraggingId]    = useState<string | null>(null);
  const [dragOverColId, setDragOverColId] = useState<string | null>(null);
  const [localStatuses, setLocalStatuses] = useState<Record<string, string>>({});

  const filtered = tasks.filter((t) => {
    if (filterSubteam && t.subTeam !== filterSubteam) return false;
    if (filterPriority && t.priority !== filterPriority) return false;
    if (filterAssignee && !t.assignees.some((a) => a.id === filterAssignee)) return false;
    return true;
  });

  // ── DnD handlers ────────────────────────────────────────────────────────────

  function handleDragStart(taskId: string) {
    setDraggingId(taskId);
  }

  function handleDragEnd() {
    setDraggingId(null);
    setDragOverColId(null);
  }

  function handleDragOver(e: React.DragEvent, colId: string, isDropTarget: boolean) {
    if (!isDropTarget || !draggingId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverColId(colId);
  }

  function handleDragLeave(e: React.DragEvent, colId: string) {
    // Only clear when leaving the column entirely, not just moving between children
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      if (dragOverColId === colId) setDragOverColId(null);
    }
  }

  function handleDrop(e: React.DragEvent, colId: string, isDropTarget: boolean) {
    e.preventDefault();
    setDragOverColId(null);
    if (!draggingId || !isDropTarget) return;

    const taskId   = draggingId;
    const newStatus = colId as TaskStatus;
    setDraggingId(null);

    // Check not same column (using current effective status)
    const currentStatus = localStatuses[taskId] ?? tasks.find((t) => t.id === taskId)?.status;
    const effectiveColId = currentStatus === "NOT_STARTED" && tasks.find(t => t.id === taskId)?.startDate
      && (tasks.find(t => t.id === taskId)!.startDate! > now) ? "FUTURE" : currentStatus;
    if (effectiveColId === colId) return;

    // Optimistic update
    setLocalStatuses((prev) => ({ ...prev, [taskId]: newStatus }));

    startTransition(async () => {
      const result = await updateTaskStatusAction(taskId, newStatus);
      if (!result.success) {
        // Revert
        setLocalStatuses((prev) => {
          const next = { ...prev };
          delete next[taskId];
          return next;
        });
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap gap-2 items-center">
        <select value={filterSubteam} onChange={(e) => setFilterSubteam(e.target.value)}
          className="text-sm rounded-md border border-[--color-border] bg-[--color-surface] text-[--color-text-primary] px-2 py-1.5">
          <option value="">All sub-teams</option>
          {SUBTEAM_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)}
          className="text-sm rounded-md border border-[--color-border] bg-[--color-surface] text-[--color-text-primary] px-2 py-1.5">
          <option value="">All priorities</option>
          <option value="CRITICAL">Critical</option>
          <option value="HIGH">High</option>
          <option value="MEDIUM">Medium</option>
          <option value="LOW">Low</option>
        </select>

        {allMembers.length > 0 && (
          <select value={filterAssignee} onChange={(e) => setFilterAssignee(e.target.value)}
            className="text-sm rounded-md border border-[--color-border] bg-[--color-surface] text-[--color-text-primary] px-2 py-1.5">
            <option value="">All assignees</option>
            {allMembers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        )}

        {(filterSubteam || filterPriority || filterAssignee) && (
          <button onClick={() => { setFilterSubteam(""); setFilterPriority(""); setFilterAssignee(""); }}
            className="text-sm text-[--color-text-secondary] hover:text-[--color-danger] transition-colors">
            Clear filters
          </button>
        )}

        <span className="ml-auto text-small text-[--color-text-secondary]">
          {filtered.length} task{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Kanban columns */}
      <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: "60vh" }}>
        {COLUMNS.map((col) => {
          const colTasks    = getColTasks(filtered, col.id, localStatuses);
          const isDragOver  = dragOverColId === col.id;
          const isDragging  = !!draggingId;

          return (
            <div key={col.id} className="flex-shrink-0 w-64 flex flex-col gap-2">
              {/* Column header */}
              <div className="flex items-center gap-2 px-1">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: col.accent }} />
                <span className="text-small font-semibold text-[--color-text-primary] truncate">{col.label}</span>
                <span className="ml-auto text-small text-[--color-text-secondary] font-medium">{colTasks.length}</span>
              </div>

              {/* Drop zone */}
              <div
                onDragOver={(e)  => handleDragOver(e, col.id, col.dropTarget)}
                onDragLeave={(e) => handleDragLeave(e, col.id)}
                onDrop={(e)      => handleDrop(e, col.id, col.dropTarget)}
                className={[
                  "flex flex-col gap-2 flex-1 rounded-lg p-2 min-h-16 transition-all",
                  isDragOver
                    ? "ring-2 ring-[--color-primary] bg-[--color-primary]/8"
                    : isDragging && col.dropTarget
                    ? "bg-[--color-surface-overlay] ring-1 ring-[--color-border] ring-dashed"
                    : "bg-[--color-surface-overlay]",
                ].join(" ")}
              >
                {colTasks.length === 0 ? (
                  <div className={`text-center py-6 text-small transition-colors ${
                    isDragOver ? "text-[--color-primary]" : "text-[--color-text-disabled]"
                  }`}>
                    {isDragOver ? "Drop here" : "Empty"}
                  </div>
                ) : (
                  colTasks.map((task) => (
                    <KanbanCard
                      key={task.id}
                      task={task}
                      isDragging={draggingId === task.id}
                      onClick={() => setSelectedTask(task)}
                      onDragStart={() => handleDragStart(task.id)}
                      onDragEnd={handleDragEnd}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {selectedTask && (
        <TaskModal
          task={selectedTask}
          allTasks={allTasks}
          allMembers={allMembers}
          allRobots={allRobots}
          kickoffDate={kickoffDate}
          week0Date={week0Date}
          onClose={() => setSelectedTask(null)}
          onUpdated={() => { setSelectedTask(null); router.refresh(); }}
        />
      )}
    </div>
  );
}

function KanbanCard({
  task, isDragging, onClick, onDragStart, onDragEnd,
}: {
  task:        KanbanTask;
  isDragging:  boolean;
  onClick:     () => void;
  onDragStart: () => void;
  onDragEnd:   () => void;
}) {
  const stColor     = SUBTEAM_COLORS[task.subTeam ?? ""] ?? "#64748B";
  const priorityCfg = PRIORITY_CONFIG[task.priority as keyof typeof PRIORITY_CONFIG];
  const overdue     = isOverdue({
    dueDate: task.dueDate ? new Date(task.dueDate) : null,
    status:  task.status as TaskStatus,
  });

  return (
    <div
      draggable
      onDragStart={(e) => {
        // Set data so the browser knows what's being dragged
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", task.id);
        // Small delay so the ghost image renders before we dim the card
        setTimeout(onDragStart, 0);
      }}
      onDragEnd={onDragEnd}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      className={[
        "w-full text-left rounded-md bg-[--color-surface-raised] border p-3 space-y-2 group",
        "cursor-grab active:cursor-grabbing",
        "hover:border-[--color-primary] hover:shadow-md transition-all",
        isDragging ? "opacity-40 scale-95" : "opacity-100",
      ].join(" ")}
      style={{ borderLeftColor: stColor, borderLeftWidth: "3px" }}
    >
      <p className="text-sm font-medium text-[--color-text-primary] leading-snug group-hover:text-[--color-primary] transition-colors">
        {task.isMilestone && <span className="text-[--color-primary] mr-1">◆</span>}
        {task.name}
      </p>

      {task.dueDate && (
        <p className={`text-xs ${overdue ? "text-[--color-danger] font-medium" : "text-[--color-text-secondary]"}`}>
          {overdue ? "Overdue · " : "Due "}{shortDate(task.dueDate)}
        </p>
      )}

      <div className="flex items-center justify-between gap-1">
        <Badge variant={priorityCfg?.variant ?? "neutral"} className="text-xs">
          {priorityCfg?.label ?? task.priority}
        </Badge>

        {task.assignees.length > 0 && (
          <div className="flex -space-x-1.5">
            {task.assignees.slice(0, 3).map((a) => (
              <div key={a.id} title={a.name}
                className="w-5 h-5 rounded-full border border-[--color-surface] flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                style={{ backgroundColor: "var(--color-primary)" }}>
                {a.name[0].toUpperCase()}
              </div>
            ))}
            {task.assignees.length > 3 && (
              <div className="w-5 h-5 rounded-full border border-[--color-surface] bg-[--color-surface-overlay] flex items-center justify-center text-xs text-[--color-text-secondary]">
                +{task.assignees.length - 3}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}


