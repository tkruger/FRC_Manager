"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

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

export function TasksTabBar() {
  const pathname    = usePathname();
  const searchParams = useSearchParams();
  const view        = searchParams.get("view") ?? "";
  const showMineOnly = searchParams.get("mine") !== "0"; // default ON

  // Build tab hrefs that preserve the mine param
  function tabHref(base: string) {
    if (showMineOnly) return base; // mine=on is the default, no extra param needed
    const sep = base.includes("?") ? "&" : "?";
    return `${base}${sep}mine=0`;
  }

  // Build toggle href: preserve current path+view, flip mine
  function mineToggleHref() {
    const params = new URLSearchParams(searchParams.toString());
    if (showMineOnly) {
      params.set("mine", "0");
    } else {
      params.delete("mine");
    }
    const qs = params.toString();
    return `${pathname}${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="flex items-center justify-between border-b border-[--color-border]">
      {/* View tabs */}
      <div className="flex gap-0.5">
        {TABS.map((tab) => {
          const active = tab.match(pathname, view);
          return (
            <Link
              key={tab.label}
              href={tabHref(tab.baseHref)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                active
                  ? "text-[--color-primary] border-[--color-primary] bg-[--color-surface-overlay]"
                  : "text-[--color-text-secondary] border-transparent hover:text-[--color-text-primary] hover:bg-[--color-surface-overlay]"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {/* My tasks toggle */}
      <div className="flex items-center py-1 pr-1">
        <Link
          href={mineToggleHref()}
          title={showMineOnly ? "Showing my tasks — click to show all" : "Showing all tasks — click to show mine only"}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all border",
            showMineOnly
              ? "border-[--color-primary] text-[--color-primary] bg-[--color-primary]/10"
              : "border-[--color-border] text-[--color-text-secondary] hover:border-[--color-border-strong] hover:text-[--color-text-primary]"
          )}
        >
          <PersonIcon className={showMineOnly ? "text-[--color-primary]" : undefined} />
          {/* Label hidden on small screens, shown on sm+ */}
          <span className="hidden sm:inline">My tasks</span>
        </Link>
      </div>
    </div>
  );
}
