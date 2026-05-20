"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { generateCalendarTokenAction } from "@/app/actions/meetings";
import { Button } from "@/components/ui/button";

export function GenerateShareLinkButton({ seasonId }: { seasonId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handle() {
    startTransition(async () => {
      const result = await generateCalendarTokenAction(seasonId);
      if (result.success) router.refresh();
    });
  }

  return (
    <Button variant="outline" size="sm" onClick={handle} isLoading={isPending}>
      Generate share link
    </Button>
  );
}
