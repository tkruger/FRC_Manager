"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { setActiveRobotAction } from "@/app/actions/robot-context";

/** Pick a robot to narrow Tasks and the Gantt chart to (remembered on this device) */
export function RobotFilterSelect({ robots, robotId }: { robots: { id: string; displayName: string }[]; robotId: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (robots.length < 2) return null;
  return (
    <label className={cn("flex items-center gap-1.5 rounded-md border px-2.5 h-9 text-sm",
      robotId ? "border-(--color-primary)/60 bg-(--color-primary)/10" : "border-(--color-border) bg-(--color-surface-raised)")}>
      <span className="text-xs text-(--color-text-secondary)">Robot</span>
      <select
        className={cn("max-w-[10rem] truncate bg-transparent text-sm font-medium text-(--color-text-primary) focus:outline-none cursor-pointer", pending && "opacity-50")}
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
