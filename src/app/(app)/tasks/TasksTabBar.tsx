"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "frc-tasks-mine";

const TABS = [
  {
    label: "Kanban",
    baseHref: "/tasks?view=kanban",
    match: (p: string, v: string) => p === "/tasks" && (v === "kanban" || v === ""),
  },
  {
    label: "Gantt",
    baseHref: "/tasks/gantt",
    match: (p: string) => p.startsWith("/tasks/gantt"),
  },
  {
    label: "List",
    baseHref: "/tasks?view=list",
    match: (p: string, v: string) => p === "/tasks" && v === "list",
  },
];

function PersonIcon({ className }: { className?: string }) {
  return (
    <svg className={cn("w-4 h-4", className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
    </svg>
  );
}

function PeopleIcon({ className }: { className?: string }) {
  return (
    <svg className={cn("w-4 h-4", className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
    </svg>
  );
}

export function TasksTabBar() {
  const router      = useRouter();
  const pathname    = usePathname();
  const searchParams = useSearchParams();
  const view        = searchParams.get("view") ?? "";
  const showMineOnly = searchParams.get("mine") !== "0";

  // On mount: if URL has no explicit mine param, apply saved preference
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "0" && searchParams.get("mine") === null) {
      // Saved preference is "all tasks" but URL is using the default (mine)
      const params = new URLSearchParams(searchParams.toString());
      params.set("mine", "0");
      router.replace(`${pathname}?${params.toString()}`);
    }
    // If stored is null or "1" and URL has no param, default (mine=on) is already correct
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function tabHref(base: string) {
    if (showMineOnly) return base;
    const sep = base.includes("?") ? "&" : "?";
    return `${base}${sep}mine=0`;
  }

  function handleToggle() {
    const nowShowingMine = showMineOnly;
    // Persist to localStorage
    if (nowShowingMine) {
      localStorage.setItem(STORAGE_KEY, "0"); // switching to "all tasks"
    } else {
      localStorage.removeItem(STORAGE_KEY);   // switching to "my tasks" (default)
    }
    // Navigate to new URL
    const params = new URLSearchParams(searchParams.toString());
    if (nowShowingMine) {
      params.set("mine", "0");
    } else {
      params.delete("mine");
    }
    const qs = params.toString();
    router.push(`${pathname}${qs ? `?${qs}` : ""}`);
  }

  return (
    <div className="flex items-center justify-between border-b border-[--color-border]">
      {/* View tabs */}
      <div className="flex gap-0.5">
        {TABS.map((tab) => {
          const active = tab.match(pathname, view);
          return (
            <a
              key={tab.label}
              href={tabHref(tab.baseHref)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                active
                  ? "text-[--color-primary] border-[--color-primary] bg-[--color-surface-overlay]"
                  : "text-[--color-text-secondary] border-transparent hover:text-[--color-text-primary] hover:bg-[--color-surface-overlay]"
              }`}
            >
              {tab.label}
            </a>
          );
        })}
      </div>

      {/* My tasks / All tasks toggle — persisted in localStorage */}
      <div className="flex items-center py-1 pr-1">
        <button
          onClick={handleToggle}
          title={showMineOnly ? "Showing my tasks — click to show all" : "Showing all tasks — click to show mine only"}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-all border",
            showMineOnly
              ? "border-[--color-primary] text-[--color-primary] bg-[--color-primary]/10"
              : "border-[--color-border] text-[--color-text-secondary] hover:border-[--color-border-strong] hover:text-[--color-text-primary]"
          )}
        >
          {showMineOnly
            ? <PersonIcon className="shrink-0" />
            : <PeopleIcon className="shrink-0" />}
          <span>{showMineOnly ? "My tasks" : "All tasks"}</span>
        </button>
      </div>
    </div>
  );
}
