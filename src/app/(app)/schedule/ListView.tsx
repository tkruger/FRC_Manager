"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
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

type SortKey = "name" | "status" | "priority" | "dueDate" | "subTeam";

interface Props {
  tasks: TaskModalData[];
  allTasks: { id: string; name: string; status: string }[];
  allMembers: { id: string; name: string }[];
  allRobots: { id: string; displayName: string }[];
  kickoffDate?: string;
  week0Date?: string;
}

const PRIORITY_ORDER: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
const STATUS_ORDER: Record<string, number> = {
  BLOCKED: 0, IN_PROGRESS: 1, IN_REVIEW: 2, NOT_STARTED: 3, COMPLETE: 4,
};

export function ListView({
  tasks,
  allTasks,
  allMembers,
  allRobots,
  kickoffDate,
  week0Date,
}: Props) {
  const router = useRouter();
  const [selectedTask, setSelectedTask] = useState<TaskModalData | null>(null);
  const [filterSubteam, setFilterSubteam] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("priority");
  const [sortAsc, setSortAsc] = useState(true);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc((a) => !a);
    else { setSortKey(key); setSortAsc(true); }
  }

  const sorted = [...tasks]
    .filter((t) => {
      if (filterSubteam && t.subTeam !== filterSubteam) return false;
      if (filterStatus && t.status !== filterStatus) return false;
      return true;
    })
    .sort((a, b) => {
      let cmp = 0;
      if (sortKey === "priority") {
        cmp = (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9);
      } else if (sortKey === "status") {
        cmp = (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9);
      } else if (sortKey === "dueDate") {
        cmp = (a.dueDate ?? "").localeCompare(b.dueDate ?? "");
      } else if (sortKey === "name") {
        cmp = a.name.localeCompare(b.name);
      } else if (sortKey === "subTeam") {
        cmp = (a.subTeam ?? "").localeCompare(b.subTeam ?? "");
      }
      return sortAsc ? cmp : -cmp;
    });

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <span className="text-[--color-text-disabled]"> ↕</span>;
    return <span className="text-[--color-primary]">{sortAsc ? " ↑" : " ↓"}</span>;
  }

  return (
    <div className="space-y-3">
      {/* Filters */}
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
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="text-sm rounded-md border border-[--color-border] bg-[--color-surface] text-[--color-text-primary] px-2 py-1.5"
        >
          <option value="">All statuses</option>
          <option value="NOT_STARTED">Not Started</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="BLOCKED">Blocked</option>
          <option value="IN_REVIEW">In Review</option>
          <option value="COMPLETE">Complete</option>
        </select>

        {(filterSubteam || filterStatus) && (
          <button
            onClick={() => { setFilterSubteam(""); setFilterStatus(""); }}
            className="text-sm text-[--color-text-secondary] hover:text-[--color-danger] transition-colors"
          >
            Clear filters
          </button>
        )}

        <span className="ml-auto text-small text-[--color-text-secondary]">
          {sorted.length} task{sorted.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-[--color-border]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[--color-border] bg-[--color-surface-overlay]">
              {(
                [
                  ["name",    "Task"],
                  ["subTeam", "Sub-team"],
                  ["status",  "Status"],
                  ["priority","Priority"],
                  ["dueDate", "Due date"],
                ] as [SortKey, string][]
              ).map(([key, label]) => (
                <th
                  key={key}
                  onClick={() => toggleSort(key)}
                  className="text-left px-4 py-3 text-label font-semibold text-[--color-text-secondary] cursor-pointer select-none hover:text-[--color-text-primary] transition-colors whitespace-nowrap"
                >
                  {label}<SortIcon col={key} />
                </th>
              ))}
              <th className="text-left px-4 py-3 text-label font-semibold text-[--color-text-secondary]">
                Assignees
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-[--color-text-secondary]">
                  No tasks match your filters
                </td>
              </tr>
            ) : (
              sorted.map((task, i) => {
                const stColor = SUBTEAM_COLORS[task.subTeam ?? ""] ?? "#64748B";
                const statusCfg = STATUS_CONFIG[task.status as TaskStatus];
                const priorityCfg = PRIORITY_CONFIG[task.priority as keyof typeof PRIORITY_CONFIG];
                const overdue = isOverdue({
                  dueDate: task.dueDate ? new Date(task.dueDate) : null,
                  status: task.status as TaskStatus,
                });

                return (
                  <tr
                    key={task.id}
                    onClick={() => setSelectedTask(task)}
                    className={`border-b border-[--color-border] cursor-pointer hover:bg-[--color-surface-overlay] transition-colors ${
                      i % 2 === 0 ? "" : "bg-[--color-surface-overlay]/30"
                    }`}
                  >
                    <td className="px-4 py-3" style={{ borderLeftColor: stColor, borderLeftWidth: "3px" }}>
                      <span className="font-medium text-[--color-text-primary]">
                        {task.isMilestone && <span className="text-[--color-primary] mr-1">◆</span>}
                        {task.name}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {task.subTeam ? (
                        <span className="text-xs font-medium" style={{ color: stColor }}>
                          {task.subTeam.replace(/_/g, " ")}
                        </span>
                      ) : (
                        <span className="text-[--color-text-disabled]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={statusCfg?.variant ?? "neutral"}>
                        {statusCfg?.label ?? task.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={priorityCfg?.variant ?? "neutral"}>
                        {priorityCfg?.label ?? task.priority}
                      </Badge>
                    </td>
                    <td className={`px-4 py-3 text-sm whitespace-nowrap ${overdue ? "text-[--color-danger] font-medium" : "text-[--color-text-secondary]"}`}>
                      {task.dueDate ? shortDate(task.dueDate) : "—"}
                      {overdue && " ⚠"}
                    </td>
                    <td className="px-4 py-3">
                      {task.assignees.length > 0 ? (
                        <div className="flex -space-x-1.5">
                          {task.assignees.slice(0, 4).map((a) => (
                            <div
                              key={a.id}
                              title={a.name}
                              className="w-6 h-6 rounded-full border-2 border-[--color-surface] flex items-center justify-center text-xs font-bold text-white"
                              style={{ backgroundColor: "var(--color-primary)" }}
                            >
                              {a.name[0].toUpperCase()}
                            </div>
                          ))}
                          {task.assignees.length > 4 && (
                            <div className="w-6 h-6 rounded-full border-2 border-[--color-surface] bg-[--color-surface-overlay] flex items-center justify-center text-xs text-[--color-text-secondary]">
                              +{task.assignees.length - 4}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-[--color-text-disabled] text-xs">Unassigned</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
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
          onUpdated={() => {
            setSelectedTask(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
