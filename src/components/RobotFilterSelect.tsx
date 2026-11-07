"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { setActiveRobotAction } from "@/app/actions/robot-context";

/**
 * Pick a robot to narrow Tasks and the Gantt chart to (remembered on this device). One solid drop-down
 * with its label beside it, like the other filters; outlined in the primary color while a robot is picked.
 */
export function RobotFilterSelect({ robots, robotId }: { robots: { id: string; displayName: string }[]; robotId: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (robots.length < 2) return null;
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-small text-(--color-text-secondary)">Robot</span>
      <select
        className={cn(
          "h-9 max-w-[11rem] truncate rounded-md border bg-(--color-surface) px-2.5 text-sm font-medium text-(--color-text-primary) focus:outline-none focus:ring-2 focus:ring-(--color-primary)/30 cursor-pointer",
          robotId ? "border-(--color-primary)" : "border-(--color-border)",
          pending && "opacity-50",
        )}
        value={robotId ?? ""}
        disabled={pending}
        aria-label="Show tasks for robot"
        onChange={(e) => {
          const id = e.target.value || null;
          start(async () => { await setActiveRobotAction(id); router.refresh(); });
        }}
      >
        <option value="">All robots</option>
        {robots.map((r) => <option key={r.id} value={r.id}>{r.displayName}</option>)}
      </select>
    </label>
  );
}
