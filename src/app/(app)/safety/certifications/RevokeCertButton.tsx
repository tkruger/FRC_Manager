"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { revokeCertificationAction } from "@/app/actions/safety";

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
    <button onClick={handle} disabled={isPending}
      className="text-[10px] text-[--color-danger] hover:underline disabled:opacity-50 mt-0.5">
      Revoke
    </button>
  );
}
