"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { denyMemberAction } from "@/app/actions/members";
import { Button } from "@/components/ui/button";

export function DenyButton({ userId }: { userId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleDeny() {
    const reason = prompt("Reason for denial (optional):") ?? undefined;
    startTransition(async () => {
      await denyMemberAction(userId, reason);
      router.refresh();
    });
  }

  return (
    <Button size="sm" variant="outline" onClick={handleDeny} isLoading={isPending}>
      Deny
    </Button>
  );
}
