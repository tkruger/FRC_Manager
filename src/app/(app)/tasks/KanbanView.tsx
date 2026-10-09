"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { updateTaskStatusAction, scheduleTaskStartAction } from "@/app/actions/tasks";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import {
  STATUS_CONFIG,
  PRIORITY_CONFIG,
  SUBTEAM_COLORS,
  SUBTEAM_OPTIONS,
  shortDate,
  isOverdue,
} from "@/lib/schedule-helpers";
import { useKanbanStyle, stickyNoteLook } from "@/lib/kanban-style";
import { TaskModal } from "./TaskModal";
import { useFinePointer, useTouchDrag } from "./useTouchDrag";
import type { TaskModalData } from "./TaskModal";
import type { TaskStatus } from "@/generated/prisma";

interface KanbanTask extends TaskModalData {}

interface Props {
  tasks:       KanbanTask[];
  allTasks:    { id: string; name: string; status: string }[];
  allMembers:  { id: string; name: string }[];
  allRobots:   { id: string; displayName: string }[];
  kickoffDate?: string;
  endDate?:  string;
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
  // Future isn't a status: Not started tasks whose start date is ahead. Dropping here asks for that date.
  { id: "FUTURE",      label: "Future",      accent: "#7C3AED", dropTarget: true  },
  { id: "NOT_STARTED", label: "Not Started", accent: "#64748B", dropTarget: true  },
  { id: "IN_PROGRESS", label: "In Progress", accent: "#1D3A8A", dropTarget: true  },
  { id: "BLOCKED",     label: "Blocked",     accent: "#C1121F", dropTarget: true  },
  { id: "IN_REVIEW",   label: "In Review",   accent: "#B45309", dropTarget: true  },
  { id: "COMPLETE",    label: "Complete",    accent: "#1A7F4B", dropTarget: true  },
];

/** Tomorrow as YYYY-MM-DD (local) — the earliest start date for a Future task */
function tomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getColTasks(tasks: KanbanTask[], colId: string, statuses: Record<string, string>, starts: Record<string, string> = {}) {
  const s = (t: KanbanTask) => statuses[t.id] ?? t.status;
  const start = (t: KanbanTask) => starts[t.id] ?? t.startDate;
  if (colId === "FUTURE")      return tasks.filter((t) => { const d = start(t); return !!d && d > now && s(t) === "NOT_STARTED"; });
  if (colId === "NOT_STARTED") return tasks.filter((t) => { const d = start(t); return s(t) === "NOT_STARTED" && (!d || d <= now); });
  return tasks.filter((t) => s(t) === colId);
}

export function KanbanView({
  tasks, allTasks, allMembers, allRobots, kickoffDate, endDate, canEdit,
}: Props) {
  const router = useRouter();
  const [, startTransition]   = useTransition();
  const [selectedTask,    setSelectedTask]   = useState<KanbanTask | null>(null);
  const [filterSubteam,   setFilterSubteam]  = useState("");
  const [filterPriority,  setFilterPriority] = useState("");
  const [filterAssignee,  setFilterAssignee] = useState("");
  const [datePreset,      setDatePreset]     = useState<"" | "week" | "2weeks" | "month" | "custom">("");
  const [customFrom,      setCustomFrom]     = useState("");
  const [customTo,        setCustomTo]       = useState("");
  // DnD state
  const [draggingId,    setDraggingId]    = useState<string | null>(null);
  const [dragOverColId, setDragOverColId] = useState<string | null>(null);
  const [localStatuses, setLocalStatuses] = useState<Record<string, string>>({});
  const [localStarts,   setLocalStarts]   = useState<Record<string, string>>({});
  // A card dropped on Future: ask when it should start
  const [futureDrop, setFutureDrop] = useState<{ taskId: string; name: string; date: string } | null>(null);

  // Compute date range from preset
  const dateRange: { from: Date; to: Date } | null = (() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    if (datePreset === "week") {
      const to = new Date(today); to.setDate(to.getDate() + 7);
      return { from: today, to };
    }
    if (datePreset === "2weeks") {
      const to = new Date(today); to.setDate(to.getDate() + 14);
      return { from: today, to };
    }
    if (datePreset === "month") {
      const to = new Date(today); to.setDate(to.getDate() + 30);
      return { from: today, to };
    }
    if (datePreset === "custom" && customFrom && customTo) {
      return { from: new Date(customFrom + "T00:00:00"), to: new Date(customTo + "T23:59:59") };
    }
    return null;
  })();

  const filtered = tasks.filter((t) => {
    if (filterSubteam && t.subTeam !== filterSubteam) return false;
    if (filterPriority && t.priority !== filterPriority) return false;
    if (filterAssignee && !t.assignees.some((a) => a.id === filterAssignee)) return false;
    if (dateRange && t.dueDate) {
      const due = new Date(t.dueDate);
      if (due < dateRange.from || due > dateRange.to) return false;
    } else if (dateRange && !t.dueDate) {
      return false; // no due date — exclude when a date filter is active
    }
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
    const taskId = draggingId;
    setDraggingId(null);
    moveTask(taskId, colId);
  }

  // Tap and hold to drag on phones and tablets (mouse dragging uses the handlers above)
  const boardRef = useRef<HTMLDivElement>(null);
  const isDropColumn = (colId: string | null) => !!colId && !!COLUMNS.find((c) => c.id === colId)?.dropTarget;
  const touch = useTouchDrag({
    onStart:  (id) => setDraggingId(id),
    onOver:   (colId) => setDragOverColId(isDropColumn(colId) ? colId : null),
    onDrop:   (id, colId) => {
      setDragOverColId(null);
      setDraggingId(null);
      if (isDropColumn(colId)) moveTask(id, colId!);
    },
    onCancel: () => { setDragOverColId(null); setDraggingId(null); },
  }, boardRef);

  /** Move a task to a column (shared by mouse and touch dragging) */
  function moveTask(taskId: string, colId: string) {
    if (colId === "FUTURE") {
      const t = tasks.find((x) => x.id === taskId);
      if (!t) return;
      const effectiveStart = localStarts[taskId] ?? t.startDate;
      if ((localStatuses[taskId] ?? t.status) === "NOT_STARTED" && effectiveStart && effectiveStart > now) return; // already in Future
      setFutureDrop({ taskId, name: t.name, date: effectiveStart && effectiveStart > now ? effectiveStart.slice(0, 10) : tomorrow() });
      return;
    }
    const newStatus = colId as TaskStatus;

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

        {/* Date filter */}
        <select
          value={datePreset}
          onChange={(e) => { setDatePreset(e.target.value as typeof datePreset); setCustomFrom(""); setCustomTo(""); }}
          className="text-sm rounded-md border border-[--color-border] bg-[--color-surface] text-[--color-text-primary] px-2 py-1.5"
        >
          <option value="">All dates</option>
          <option value="week">Next 7 days</option>
          <option value="2weeks">Next 2 weeks</option>
          <option value="month">Next 30 days</option>
          <option value="custom">Custom range…</option>
        </select>

        {datePreset === "custom" && (
          <>
            <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)}
              className="text-sm rounded-md border border-[--color-border] bg-[--color-surface] text-[--color-text-primary] px-2 py-1.5" />
            <span className="text-small text-[--color-text-secondary]">to</span>
            <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)}
              className="text-sm rounded-md border border-[--color-border] bg-[--color-surface] text-[--color-text-primary] px-2 py-1.5" />
          </>
        )}

        {(filterSubteam || filterPriority || filterAssignee || datePreset) && (
          <button onClick={() => { setFilterSubteam(""); setFilterPriority(""); setFilterAssignee(""); setDatePreset(""); setCustomFrom(""); setCustomTo(""); }}
            className="text-sm text-[--color-text-secondary] hover:text-[--color-danger] transition-colors">
            Clear filters
          </button>
        )}

        <span className="ml-auto text-small text-[--color-text-secondary]">
          {filtered.length} task{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Kanban columns */}
      <div ref={boardRef} className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: "60vh" }}>
        {COLUMNS.map((col) => {
          const colTasks    = getColTasks(filtered, col.id, localStatuses, localStarts);
          const isDragOver  = dragOverColId === col.id;
          const isDragging  = !!draggingId;

          return (
            <div key={col.id} data-kanban-col={col.id} className="flex-shrink-0 w-64 flex flex-col gap-2">
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
                      onClick={() => { if (!touch.justDragged.current) setSelectedTask(task); }}
                      onDragStart={() => handleDragStart(task.id)}
                      onDragEnd={handleDragEnd}
                      onTouchHold={(el, e) => touch.begin(task.id, el, e)}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {futureDrop && (
        <Dialog open onOpenChange={(o) => { if (!o) setFutureDrop(null); }}>
          <DialogContent title="Start later" description={`When should "${futureDrop.name}" start? It waits in Future until then.`}>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                const { taskId, date } = futureDrop;
                setFutureDrop(null);
                // Show it in Future right away; undo if saving fails
                setLocalStatuses((p) => ({ ...p, [taskId]: "NOT_STARTED" }));
                setLocalStarts((p) => ({ ...p, [taskId]: `${date}T00:00:00.000Z` }));
                startTransition(async () => {
                  const res = await scheduleTaskStartAction(taskId, date);
                  if (!res.success) {
                    toast.error(res.error ?? "Couldn't reschedule the task.");
                    setLocalStatuses((p) => { const n = { ...p }; delete n[taskId]; return n; });
                    setLocalStarts((p) => { const n = { ...p }; delete n[taskId]; return n; });
                  }
                  router.refresh();
                });
              }}
            >
              <label className="block space-y-1.5">
                <span className="block text-sm font-medium text-(--color-text-primary)">Start date</span>
                <input
                  type="date"
                  required
                  min={tomorrow()}
                  value={futureDrop.date}
                  onChange={(e) => setFutureDrop({ ...futureDrop, date: e.target.value })}
                  className="h-11 w-full rounded-md border border-(--color-border) bg-(--color-surface) px-3 text-sm text-(--color-text-primary) focus:border-(--color-primary) focus:outline-none"
                />
              </label>
              <p className="text-small text-(--color-text-secondary)">If the due date would come before this, it moves too, keeping the task&apos;s length.</p>
              <div className="flex gap-2">
                <Button type="submit">Move to Future</Button>
                <Button type="button" variant="outline" onClick={() => setFutureDrop(null)}>Cancel</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {selectedTask && (
        <TaskModal
          task={selectedTask}
          allTasks={allTasks}
          allMembers={allMembers}
          allRobots={allRobots}
          kickoffDate={kickoffDate}
          endDate={endDate}
          onClose={() => setSelectedTask(null)}
          onUpdated={() => { setSelectedTask(null); router.refresh(); }}
        />
      )}
    </div>
  );
}

function KanbanCard({
  task, isDragging, onClick, onDragStart, onDragEnd, onTouchHold,
}: {
  task:        KanbanTask;
  isDragging:  boolean;
  onClick:     () => void;
  onDragStart: () => void;
  onDragEnd:   () => void;
  /** Touch screens: a finger went down on the card (may become a tap-and-hold drag) */
  onTouchHold: (el: HTMLElement, e: React.TouchEvent) => void;
}) {
  const stColor     = SUBTEAM_COLORS[task.subTeam ?? ""] ?? "#64748B";
  const priorityCfg = PRIORITY_CONFIG[task.priority as keyof typeof PRIORITY_CONFIG];
  const overdue     = isOverdue({
    dueDate: task.dueDate ? new Date(task.dueDate) : null,
    status:  task.status as TaskStatus,
  });

  const { style, color } = useKanbanStyle();
  // Mouse/trackpad: the browser's drag and drop. Touch: our tap-and-hold (see useTouchDrag).
  const mouseDrag = useFinePointer();

  const dragProps = {
    draggable: mouseDrag,
    onDragStart: (e: React.DragEvent) => {
      // Set data so the browser knows what's being dragged
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", task.id);
      // Small delay so the ghost image renders before we dim the card
      setTimeout(onDragStart, 0);
    },
    onDragEnd,
    onClick,
    onTouchStart: (e: React.TouchEvent<HTMLElement>) => onTouchHold(e.currentTarget, e),
    // No long-press menu or text selection — holding a card picks it up
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    role: "button" as const,
    tabIndex: 0,
    onKeyDown: (e: React.KeyboardEvent) => e.key === "Enter" && onClick(),
  };

  const body = (
    <>
        <p className="text-sm font-medium text-(--color-text-primary) leading-snug group-hover:text-(--color-primary) transition-colors">
          {task.isMilestone && <span className="text-(--color-primary) mr-1">◆</span>}
          {task.name}
        </p>

        {task.dueDate && (
          <p className={`text-xs ${overdue ? "text-(--color-danger) font-medium" : "text-(--color-text-secondary)"}`}>
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
                  className="w-5 h-5 rounded-full border border-(--color-surface) flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                  style={{ backgroundColor: "var(--color-primary)" }}>
                  {a.name[0].toUpperCase()}
                </div>
              ))}
              {task.assignees.length > 3 && (
                <div className="w-5 h-5 rounded-full border border-(--color-surface) bg-(--color-surface-overlay) flex items-center justify-center text-xs text-(--color-text-secondary)">
                  +{task.assignees.length - 3}
                </div>
              )}
            </div>
          )}
        </div>
    </>
  );

  if (style !== "plain") {
    // Sticky note: paper color, a slight tilt, folded corner and shadow; the pin shows the sub-team
    const look = stickyNoteLook(task.id, style, color);
    return (
      <div
        {...dragProps}
        className={[
          "sticky-note-wrap select-none [-webkit-touch-callout:none] cursor-grab active:cursor-grabbing outline-none focus-visible:ring-2 focus-visible:ring-(--color-primary) rounded-sm",
          isDragging ? "opacity-40" : "opacity-100",
        ].join(" ")}
        style={{ transform: `rotate(${look.tilt}deg)` }}
      >
        <div className="sticky-note px-3 pb-4 pt-4 space-y-2" style={{ "--note": look.hex } as React.CSSProperties}>
          <span aria-hidden title={task.subTeam ?? undefined}
            className="absolute left-1/2 top-1 h-2.5 w-2.5 -translate-x-1/2 rounded-full shadow-[0_1px_1px_rgb(0_0_0/0.35)]"
            style={{ backgroundColor: stColor }} />
          {body}
        </div>
      </div>
    );
  }

  return (
    <div
      {...dragProps}
      className={[
        "w-full text-left rounded-md bg-(--color-surface-raised) border p-3 space-y-2 group select-none [-webkit-touch-callout:none]",
        "cursor-grab active:cursor-grabbing",
        "hover:border-(--color-primary) hover:shadow-md transition-all",
        isDragging ? "opacity-40 scale-95" : "opacity-100",
      ].join(" ")}
      style={{ borderLeftColor: stColor, borderLeftWidth: "3px" }}
    >
      {body}
    </div>
  );
}


