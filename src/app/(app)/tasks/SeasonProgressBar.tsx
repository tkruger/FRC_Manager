"use client";

import { useEffect, useState } from "react";
import { SUBTEAM_COLORS, shortDate } from "@/lib/schedule-helpers";

const STORAGE_KEY = "frc-schedule-progress-collapsed";

interface Props {
  kickoffDate: string;
  week0Date: string;
  daysToWeek0: number;
  buildProgress: number;
  totalTasks: number;
  completeTasks: number;
  subteamStats: Record<string, { total: number; done: number }>;
}

export function SeasonProgressBar({
  kickoffDate,
  week0Date,
  daysToWeek0,
  buildProgress,
  totalTasks,
  completeTasks,
  subteamStats,
}: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setCollapsed(localStorage.getItem(STORAGE_KEY) === "true");
    setMounted(true);
  }, []);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem(STORAGE_KEY, String(next));
  }

  // Avoid layout flash before localStorage is read
  if (!mounted) return null;

  return (
    <div className="card py-3 px-4">
      {/* Always-visible summary row — entire row is the toggle */}
      <button
        onClick={toggle}
        title={collapsed ? "Expand season progress" : "Collapse season progress"}
        aria-expanded={!collapsed}
        className="w-full flex items-center justify-between gap-4 text-left group"
      >
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 min-w-0">
          <p className="text-small text-[--color-text-secondary] whitespace-nowrap">
            Kickoff {shortDate(new Date(kickoffDate))} → Week 0 {shortDate(new Date(week0Date))}
            {daysToWeek0 >= 0
              ? <span className="ml-1 font-medium text-[--color-text-primary]">· {daysToWeek0}d left</span>
              : <span className="ml-1 font-medium text-[--color-warning]">· {Math.abs(daysToWeek0)}d ago</span>}
          </p>
          <p className="text-small font-medium text-[--color-text-primary] whitespace-nowrap">
            {completeTasks}/{totalTasks} tasks complete
          </p>
        </div>

        <svg
          viewBox="0 0 16 16"
          className={`shrink-0 w-3.5 h-3.5 text-[--color-text-secondary] group-hover:text-[--color-text-primary] transition-all duration-200 ${collapsed ? "" : "rotate-180"}`}
          fill="currentColor"
        >
          <path d="M8 10.5a.75.75 0 01-.53-.22l-4-4a.75.75 0 111.06-1.06L8 8.69l3.47-3.47a.75.75 0 111.06 1.06l-4 4A.75.75 0 018 10.5z" />
        </svg>
      </button>

      {/* Collapsible body */}
      {!collapsed && (
        <div className="mt-3 space-y-3">
          {/* Progress bar */}
          <div className="w-full h-2 rounded-full bg-[--color-surface-overlay] overflow-hidden">
            <div
              className="h-full rounded-full bg-[--color-primary] transition-all"
              style={{ width: `${buildProgress}%` }}
            />
          </div>

          {/* Sub-team breakdown */}
          {Object.keys(subteamStats).length > 0 && (
            <div className="pt-2 border-t border-[--color-border] grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
              {Object.entries(subteamStats).map(([st, s]) => {
                const pct = s.total ? Math.round((s.done / s.total) * 100) : 0;
                const color = SUBTEAM_COLORS[st] ?? "#64748B";
                return (
                  <div key={st}>
                    <div className="flex justify-between text-small mb-1">
                      <span style={{ color }} className="font-medium truncate">{st.replace(/_/g, " ")}</span>
                      <span className="text-[--color-text-secondary] shrink-0 ml-1">{s.done}/{s.total}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[--color-surface-overlay]">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

