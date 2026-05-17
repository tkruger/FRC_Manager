"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateCheckItemAction } from "@/app/actions/safety";
import { cn } from "@/lib/utils";

type Status = "PASS" | "FAIL" | "NOT_CHECKED";

export function CheckItemButton({ itemId, currentStatus, status, label }: {
  itemId: string; currentStatus: Status; status: "PASS" | "FAIL"; label: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isActive = currentStatus === status;

  function handle() {
    const next: Status = isActive ? "NOT_CHECKED" : status;
    startTransition(async () => {
      await updateCheckItemAction(itemId, next);
      router.refresh();
    });
  }

  return (
    <button
      onClick={handle}
      disabled={isPending}
      className={cn(
        "w-8 h-8 rounded font-bold text-sm transition-colors disabled:opacity-50",
        status === "PASS"
          ? isActive ? "bg-[--color-success] text-white" : "border border-[--color-border] text-[--color-text-disabled] hover:border-[--color-success] hover:text-[--color-success]"
          : isActive ? "bg-[--color-danger] text-white" : "border border-[--color-border] text-[--color-text-disabled] hover:border-[--color-danger] hover:text-[--color-danger]"
      )}
    >
      {label}
    </button>
  );
}
