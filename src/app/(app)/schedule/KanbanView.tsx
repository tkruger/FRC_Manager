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

interface KanbanTask extends TaskModalData {
  // already has all the fields
}

interface Props {
  tasks: KanbanTask[];
  allTasks: { id: string; name: string; status: string }[];
  allMembers: { id: string; name: string }[];
  allRobots: { id: string; displayName: string }[];
  kickoffDate?: string;
  week0Date?: string;
  canEdit: boolean;
}

interface Column {
  id: string;
  label: string;
  filter: (t: KanbanTask) => boolean;
  accent: string;
}

const now = new Date().toISOString();

const COLUMNS: Column[] = [
  {
    id: "FUTURE",
    label: "Future",
    filter: (t) => !!t.startDate && t.startDate > now && t.status === "NOT_STARTED",
    accent: "#7C3AED",
  },
  {
    id: "NOT_STARTED",
    label: "Not Started",
    filter: (t) => t.status === "NOT_STARTED" && (!t.startDate || t.startDate <= now),
    accent: "#64748B",
  },
  {
    id: "IN_PROGRESS",
    label: "In Progress",
    filter: (t) => t.status === "IN_PROGRESS",
    accent: "#1D3A8A",
  },
  {
    id: "BLOCKED",
    label: "Blocked",
    filter: (t) => t.status === "BLOCKED",
    accent: "#C1121F",
  },
  {
    id: "IN_REVIEW",
    label: "In Review",
    filter: (t) => t.status === "IN_REVIEW",
    accent: "#B45309",
  },
  {
    id: "COMPLETE",
    label: "Complete",
    filter: (t) => t.status === "COMPLETE",
    accent: "#1A7F4B",
  },
];

export function KanbanView({
  tasks,
  allTasks,
  allMembers,
  allRobots,
  kickoffDate,
  week0Date,
  canEdit,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedTask, setSelectedTask] = useState<KanbanTask | null>(null);
  const [filterSubteam, setFilterSubteam] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [filterAssignee, setFilterAssignee] = useState("");

  const filtered = tasks.filter((t) => {
    if (filterSubteam && t.subTeam !== filterSubteam) return false;
    if (filterPriority && t.priority !== filterPriority) return false;
    if (filterAssignee && !t.assignees.some((a) => a.id === filterAssignee)) return false;
    return true;
  });

  function handleStatusDrop(taskId: string, newStatus: TaskStatus) {
    startTransition(async () => {
      await updateTaskStatusAction(taskId, newStatus);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap gap-2 items-center">
        <select
          value={filterSubteam}
          onChange={(e) => setFilterSubteam(e.target.value)}
          className="text-sm rounded-md border border-[--color-border] bg-[--color-surface] text-[--color-text-primary] px-2 py-1.5"
        >
          <option value="">All sub-teams</option>
          {SUBTEAM_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <select
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value)}
          className="text-sm rounded-md border border-[--color-border] bg-[--color-surface] text-[--color-text-primary] px-2 py-1.5"
        >
          <option value="">All priorities</option>
          <option value="CRITICAL">Critical</option>
          <option value="HIGH">High</option>
          <option value="MEDIUM">Medium</option>
          <option value="LOW">Low</option>
        </select>

        {allMembers.length > 0 && (
          <select
            value={filterAssignee}
            onChange={(e) => setFilterAssignee(e.target.value)}
            className="text-sm rounded-md border border-[--color-border] bg-[--color-surface] text-[--color-text-primary] px-2 py-1.5"
          >
            <option value="">All assignees</option>
            {allMembers.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        )}

        {(filterSubteam || filterPriority || filterAssignee) && (
          <button
            onClick={() => { setFilterSubteam(""); setFilterPriority(""); setFilterAssignee(""); }}
            className="text-sm text-[--color-text-secondary] hover:text-[--color-danger] transition-colors"
          >
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
          const colTasks = filtered.filter(col.filter);
          return (
            <div key={col.id} className="flex-shrink-0 w-64 flex flex-col gap-2">
              {/* Column header */}
              <div className="flex items-center gap-2 px-1">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: col.accent }} />
                <span className="text-small font-semibold text-[--color-text-primary] truncate">{col.label}</span>
                <span className="ml-auto text-small text-[--color-text-secondary] font-medium">{colTasks.length}</span>
              </div>

              {/* Drop zone + cards */}
              <div className="flex flex-col gap-2 flex-1 rounded-lg bg-[--color-surface-overlay] p-2 min-h-16">
                {colTasks.length === 0 ? (
                  <div className="text-center py-6 text-small text-[--color-text-disabled]">
                    Empty
                  </div>
                ) : (
                  colTasks.map((task) => (
                    <KanbanCard
                      key={task.id}
                      task={task}
                      onClick={() => setSelectedTask(task)}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Task modal */}
      {selectedTask && (
        <TaskModal
          task={selectedTask}
          allTasks={allTasks}
          allMembers={allMembers}
          allRobots={allRobots}
          kickoffDate={kickoffDate}
          week0Date={week0Date}
          onClose={() => setSelectedTask(null)}
          onUpdated={() => {
            setSelectedTask(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function KanbanCard({ task, onClick }: { task: KanbanTask; onClick: () => void }) {
  const stColor = SUBTEAM_COLORS[task.subTeam ?? ""] ?? "#64748B";
  const priorityCfg = PRIORITY_CONFIG[task.priority as keyof typeof PRIORITY_CONFIG];
  const overdue = isOverdue({
    dueDate: task.dueDate ? new Date(task.dueDate) : null,
    status: task.status as TaskStatus,
  });

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-md bg-[--color-surface-raised] border border-[--color-border] p-3 hover:border-[--color-primary] hover:shadow-md transition-all space-y-2 group"
      style={{ borderLeftColor: stColor, borderLeftWidth: "3px" }}
    >
      {/* Task name */}
      <p className="text-sm font-medium text-[--color-text-primary] leading-snug group-hover:text-[--color-primary] transition-colors">
        {task.isMilestone && <span className="text-[--color-primary] mr-1">◆</span>}
        {task.name}
      </p>

      {/* Due date */}
      {task.dueDate && (
        <p className={`text-xs ${overdue ? "text-[--color-danger] font-medium" : "text-[--color-text-secondary]"}`}>
          {overdue ? "Overdue · " : "Due "}{shortDate(task.dueDate)}
        </p>
      )}

      {/* Bottom row: priority + assignees */}
      <div className="flex items-center justify-between gap-1">
        <Badge variant={priorityCfg?.variant ?? "neutral"} className="text-xs">
          {priorityCfg?.label ?? task.priority}
        </Badge>

        {task.assignees.length > 0 && (
          <div className="flex -space-x-1.5">
            {task.assignees.slice(0, 3).map((a) => (
              <div
                key={a.id}
                title={a.name}
                className="w-5 h-5 rounded-full border border-[--color-surface] flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                style={{ backgroundColor: "var(--color-primary)" }}
              >
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
    </button>
  );
}
