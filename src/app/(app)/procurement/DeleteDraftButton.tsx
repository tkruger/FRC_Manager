"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteOrderDraftAction } from "@/app/actions/orders";
import { toast } from "@/components/ui/toast";

export function DeleteDraftButton({ draftId, name }: { draftId: string; name: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm(`Delete the draft "${name}"?`)) return;
        start(async () => {
          const res = await deleteOrderDraftAction(draftId);
          if (res.success) { toast.success("Draft deleted"); router.refresh(); }
          else toast.error(res.error);
        });
      }}
      className="text-small font-medium text-(--color-danger) hover:underline disabled:opacity-50"
    >
      {pending ? "Deleting…" : "Delete"}
    </button>
  );
}
