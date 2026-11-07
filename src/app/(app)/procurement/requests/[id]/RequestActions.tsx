"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  approvePurchaseRequestAction,
  denyPurchaseRequestAction,
  cancelPurchaseRequestAction,
} from "@/app/actions/procurement";
import type { AvailableAction } from "@/lib/workflow/rules";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { usePageAction } from "@/components/page-actions";

interface Props {
  requestId: string;
  /** Computed server-side from the order's workflow step and the viewer's roles */
  actions:   AvailableAction[];
}

type Panel = null | "deny" | "cancel";

/** Page actions the header's Approve / Deny / Cancel order fire (the page uses the same names) */
const ORDER_DECISIONS = { approve: "order:approve", deny: "order:deny", cancel: "order:cancel" } as const;

/**
 * Order-level decisions — the buttons are in the page header (Approve, Deny; Cancel order in its ⋯ menu);
 * this does the work and shows the reason box for a denial or cancellation under the header.
 * Ordering and arrival happen per item in the items table.
 */
export function RequestActions({ requestId, actions }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [panel, setPanel]   = useState<Panel>(null);
  const [reason, setReason] = useState("");
  const [error, setError]   = useState<string | null>(null);

  const approve = actions.find((a) => a.action === "approve");
  const deny    = actions.find((a) => a.action === "deny");
  const cancel  = actions.find((a) => a.action === "cancel");

  function run(fn: () => Promise<{ success: boolean; error?: string }>, done?: string) {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.success) { setError(result.error ?? "Something went wrong."); toast.error(result.error ?? "Something went wrong."); return; }
      if (done) toast.success(done);
      setPanel(null);
      setReason("");
      router.refresh();
    });
  }

  usePageAction(approve ? ORDER_DECISIONS.approve : undefined, () => run(() => approvePurchaseRequestAction(requestId, approve!.stepKey), "Order approved"));
  usePageAction(deny ? ORDER_DECISIONS.deny : undefined, () => { setPanel("deny"); setError(null); });
  usePageAction(cancel ? ORDER_DECISIONS.cancel : undefined, () => { setPanel("cancel"); setError(null); });

  if (!panel) return null;
  return (
    <div className="card space-y-3 border-(--color-danger)/40">
      <Textarea
        label={panel === "deny" ? "Reason for denying this order" : "Reason for canceling this order"}
        rows={2}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Optional — shared with the requester"
        autoFocus
      />
      {error && <p className="text-sm text-(--color-danger)">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="danger" isLoading={isPending}
          onClick={() => run(() => panel === "deny"
            ? denyPurchaseRequestAction(requestId, deny!.stepKey, reason)
            : cancelPurchaseRequestAction(requestId, cancel!.stepKey, reason), panel === "deny" ? "Order denied" : "Order canceled")}>
          {panel === "deny" ? "Deny order" : "Cancel order"}
        </Button>
        <Button size="sm" variant="outline" onClick={() => setPanel(null)} disabled={isPending}>Keep it</Button>
      </div>
    </div>
  );
}
