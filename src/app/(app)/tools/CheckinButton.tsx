"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { checkinToolAction } from "@/app/actions/tools";

export function CheckinButton({ checkoutId, toolName }: { checkoutId: string; toolName: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handle() {
    const condition = prompt(`Return condition for "${toolName}":\n(EXCELLENT / GOOD / FAIR / NEEDS_REPAIR)`, "GOOD") ?? "GOOD";
    startTransition(async () => {
      await checkinToolAction(checkoutId, condition.toUpperCase().replace(/ /g, "_"));
      router.refresh();
    });
  }

  return (
    <button onClick={handle} disabled={isPending}
      className="text-small text-[--color-success] hover:underline disabled:opacity-50">
      Check in
    </button>
  );
}
