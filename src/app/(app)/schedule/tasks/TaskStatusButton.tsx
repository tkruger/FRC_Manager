"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateTaskStatusAction } from "@/app/actions/tasks";
import { STATUS_CONFIG, STATUS_OPTIONS } from "@/lib/schedule-helpers";
import type { TaskStatus } from "@/generated/prisma";

export function TaskStatusButton({ taskId, currentStatus }: { taskId: string; currentStatus: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const cfg = STATUS_CONFIG[currentStatus as TaskStatus];

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newStatus = e.target.value as TaskStatus;
    startTransition(async () => {
      await updateTaskStatusAction(taskId, newStatus);
      router.refresh();
    });
  }

  const variantClasses: Record<string, string> = {
    success: "text-[--color-success]",
    warning: "text-[--color-warning]",
    danger:  "text-[--color-danger]",
    info:    "text-[--color-info]",
    neutral: "text-[--color-text-secondary]",
  };

  return (
    <select
      value={currentStatus}
      onChange={handleChange}
      disabled={isPending}
      className={`text-sm font-medium bg-transparent border-none focus:outline-none cursor-pointer disabled:opacity-50 ${variantClasses[cfg.variant]}`}
    >
      {STATUS_OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}
