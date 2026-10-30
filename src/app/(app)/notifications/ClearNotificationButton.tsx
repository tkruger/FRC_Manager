"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";

/** Clear one notification (✕), or all of them */
export function ClearNotificationButton({ id, all = false }: { id?: string; all?: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handle() {
    if (all && !confirm("Clear all your notifications?")) return;
    startTransition(async () => {
      await fetch("/api/notifications", { method: "DELETE", body: JSON.stringify({ ids: all || !id ? [] : [id] }) });
      router.refresh();
    });
  }

  if (all) {
    return <Button variant="outline" size="sm" onClick={handle} isLoading={isPending}>Clear all</Button>;
  }
  return (
    <button type="button" onClick={handle} disabled={isPending} aria-label="Clear this notification" title="Clear"
      className="shrink-0 self-center mr-2 h-9 w-9 rounded-md flex items-center justify-center text-(--color-text-secondary) hover:bg-(--color-surface-overlay) hover:text-(--color-text-primary) disabled:opacity-40">
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  );
}
