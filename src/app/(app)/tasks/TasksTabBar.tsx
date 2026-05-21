"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";

const TABS = [
  {
    label: "Kanban",
    href: "/tasks?view=kanban",
    match: (p: string, v: string) => p === "/tasks" && (v === "kanban" || v === ""),
  },
  {
    label: "Gantt",
    href: "/tasks/gantt",
    match: (p: string) => p.startsWith("/tasks/gantt"),
  },
  {
    label: "List",
    href: "/tasks?view=list",
    match: (p: string, v: string) => p === "/tasks" && v === "list",
  },
];

export function TasksTabBar({ canEdit }: { canEdit: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const view = searchParams.get("view") ?? "";

  return (
    <div className="flex items-center justify-between border-b border-[--color-border]">
      <div className="flex gap-0.5">
        {TABS.map((tab) => {
          const active = tab.match(pathname, view);
          return (
            <Link
              key={tab.label}
              href={tab.href}
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

      <div className="flex items-center gap-2 py-2 pr-1">
        {canEdit && (
          <>
            <Link href="/tasks/templates">
              <Button variant="outline" size="sm">Templates</Button>
            </Link>
            <Link href="/tasks/new">
              <Button size="sm">+ New task</Button>
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

