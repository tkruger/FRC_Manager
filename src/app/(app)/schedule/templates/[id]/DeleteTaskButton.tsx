"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteTemplateTaskAction } from "@/app/actions/templates";
import { Trash2 } from "lucide-react";

export function DeleteTaskButton({ taskId }: { taskId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handle() {
    if (!confirm("Remove this task from the template?")) return;
    startTransition(async () => {
      await deleteTemplateTaskAction(taskId);
      router.refresh();
    });
  }

  return (
    <button onClick={handle} disabled={isPending}
      className="text-[--color-text-disabled] hover:text-[--color-danger] transition-colors disabled:opacity-50 p-1"
      title="Remove task">
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}
