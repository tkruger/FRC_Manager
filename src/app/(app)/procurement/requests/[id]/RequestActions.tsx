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

interface Props {
  requestId: string;
  /** Computed server-side from the order's workflow step and the viewer's roles */
  actions:   AvailableAction[];
}

type Panel = null | "deny" | "cancel";

/** Order-level decisions. Ordering and arrival happen per item in the items table. */
export function RequestActions({ requestId, actions }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [panel, setPanel]   = useState<Panel>(null);
  const [reason, setReason] = useState("");
  const [error, setError]   = useState<string | null>(null);

  const approve = actions.find((a) => a.action === "approve");
  const deny    = actions.find((a) => a.action === "deny");
  const cancel  = actions.find((a) => a.action === "cancel");

  function run(fn: () => Promise<{ success: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.success) { setError(result.error ?? "Something went wrong."); return; }
      setPanel(null);
      setReason("");
      router.refresh();
    });
  }

  if (!approve && !deny && !cancel) return null;

  return (
    <div className="flex flex-col gap-2 sm:items-end shrink-0">
      {panel === null && (
        <div className="flex flex-wrap gap-2">
          {approve && (
            <Button size="sm" isLoading={isPending} onClick={() => run(() => approvePurchaseRequestAction(requestId, approve.stepKey))}>
              Approve
            </Button>
          )}
          {deny && <Button size="sm" variant="danger" onClick={() => setPanel("deny")}>Deny</Button>}
          {cancel && <Button size="sm" variant="ghost" onClick={() => setPanel("cancel")}>Cancel order</Button>}
        </div>
      )}

      {panel && (
        <div className="w-full sm:w-72 card space-y-3">
          <Textarea
            label={panel === "deny" ? "Reason for denial" : "Reason for canceling"}
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Optional — shared with the requester"
          />
          <div className="flex gap-2">
            <Button size="sm" variant="danger" isLoading={isPending}
              onClick={() => run(() => panel === "deny"
                ? denyPurchaseRequestAction(requestId, deny!.stepKey, reason)
                : cancelPurchaseRequestAction(requestId, cancel!.stepKey, reason))}>
              {panel === "deny" ? "Confirm deny" : "Confirm cancel"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setPanel(null)}>Back</Button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-(--color-danger) max-w-xs">{error}</p>}
    </div>
  );
}
