"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { revokeCertificationAction } from "@/app/actions/safety";
import { Button } from "@/components/ui/button";

export function RevokeCertButton({ userId, certName }: { userId: string; certName: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handle() {
    if (!confirm(`Revoke "${certName}" for this member?`)) return;
    startTransition(async () => {
      await revokeCertificationAction(userId, certName);
      router.refresh();
    });
  }

  return (
    <Button type="button" variant="dangerOutline" size="xs" onClick={handle} disabled={isPending} className="mt-0.5">
      Revoke
    </Button>
  );
}
