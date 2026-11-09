"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteOrderDraftAction } from "@/app/actions/orders";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";

export function DeleteDraftButton({ draftId, name }: { draftId: string; name: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      variant="dangerOutline"
      size="sm"
      disabled={pending}
      onClick={() => {
        if (!confirm(`Delete the draft "${name}"?`)) return;
        start(async () => {
          const res = await deleteOrderDraftAction(draftId);
          if (res.success) { toast.success("Draft deleted"); router.refresh(); }
          else toast.error(res.error);
        });
      }}
    >
      {pending ? "Deleting…" : "Delete"}
    </Button>
  );
}
