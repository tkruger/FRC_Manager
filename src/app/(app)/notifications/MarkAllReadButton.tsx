"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";

export function MarkAllReadButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handle() {
    startTransition(async () => {
      await fetch("/api/notifications", { method: "POST", body: JSON.stringify({ ids: [] }) });
      router.refresh();
    });
  }

  return (
    <Button variant="outline" size="sm" onClick={handle} isLoading={isPending}>
      Mark all read
    </Button>
  );
}
