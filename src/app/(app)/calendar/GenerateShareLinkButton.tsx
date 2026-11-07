"use client";

import { usePageAction } from "@/components/page-actions";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { generateCalendarTokenAction } from "@/app/actions/meetings";
import { Button } from "@/components/ui/button";

/** `action`: run by that page action (the header) instead of its own button */
export function GenerateShareLinkButton({ seasonId, action }: { seasonId: string; action?: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handle() {
    startTransition(async () => {
      const result = await generateCalendarTokenAction(seasonId);
      if (result.success) router.refresh();
    });
  }

  usePageAction(action, handle);
  if (action) return null;
  return (
    <Button variant="outline" size="sm" onClick={handle} isLoading={isPending}>
      Generate share link
    </Button>
  );
}

