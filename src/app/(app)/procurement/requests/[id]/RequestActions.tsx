"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  approvePurchaseRequestAction,
  denyPurchaseRequestAction,
  cancelPurchaseRequestAction,
  markOrderedAction,
  markReceivedAction,
} from "@/app/actions/procurement";
import type { AvailableAction } from "@/lib/workflow/rules";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  requestId:        string;
  /** Computed server-side from the request's workflow step and the viewer's roles */
  actions:          AvailableAction[];
  estimatedTotal:   number | null;
  linkedStockLines: number;
}

type Panel = null | "deny" | "cancel" | "order";

export function RequestActions({ requestId, actions, estimatedTotal, linkedStockLines }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [panel, setPanel]   = useState<Panel>(null);
  const [reason, setReason] = useState("");
  const [error, setError]   = useState<string | null>(null);

  const find = (a: AvailableAction["action"]) => actions.find((x) => x.action === a);
  const approve = find("approve"), deny = find("deny"), order = find("order"), receive = find("receive"), cancel = find("cancel");

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

  if (actions.length === 0) return null;

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
          {order && <Button size="sm" variant="secondary" onClick={() => setPanel("order")}>Mark as ordered</Button>}
          {receive && (
            <Button
              size="sm"
              variant="secondary"
              isLoading={isPending}
              onClick={() => {
                const msg = linkedStockLines > 0
                  ? `Confirm delivery? ${linkedStockLines} line item${linkedStockLines === 1 ? "" : "s"} will be added to inventory.`
                  : "Confirm the delivery arrived?";
                if (confirm(msg)) run(() => markReceivedAction(requestId, receive.stepKey));
              }}
            >
              Mark received
            </Button>
          )}
          {cancel && <Button size="sm" variant="ghost" onClick={() => setPanel("cancel")}>Cancel request</Button>}
        </div>
      )}

      {(panel === "deny" || panel === "cancel") && (
        <div className="w-full sm:w-72 card space-y-3">
          <Textarea
            label={panel === "deny" ? "Reason for denial" : "Reason for cancelling"}
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

      {panel === "order" && order && (
        <form
          className="w-full sm:w-72 card space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            run(() => markOrderedAction(requestId, order.stepKey, fd));
          }}
        >
          <p className="text-h3 text-[--color-text-primary]">Order details</p>
          <Field label="Confirmation #" name="orderConfirmation" placeholder="Order / invoice number" />
          <Field label="Actual total ($)" name="actualTotal" type="number" step="0.01" min="0"
            placeholder={estimatedTotal != null ? estimatedTotal.toFixed(2) : "0.00"} />
          <Field label="Expected delivery" name="expectedDelivery" type="date" />
          <div className="flex gap-2">
            <Button type="submit" size="sm" isLoading={isPending}>Save</Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setPanel(null)}>Back</Button>
          </div>
        </form>
      )}

      {error && <p className="text-sm text-[--color-danger] max-w-xs">{error}</p>}
    </div>
  );
}
