"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteTaskAction } from "@/app/actions/tasks";
import { Button } from "@/components/ui/button";

export function DeleteTaskButton({ taskId }: { taskId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handle() {
    if (!confirm("Delete this task? This cannot be undone.")) return;
    startTransition(async () => {
      await deleteTaskAction(taskId);
      router.push("/schedule/tasks");
    });
  }

  return (
    <Button variant="danger" size="sm" onClick={handle} isLoading={isPending}>
      Delete
    </Button>
  );
}
