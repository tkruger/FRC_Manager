"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { PurchaseStatus } from "@/generated/prisma";
import { approvePurchaseRequestAction, denyPurchaseRequestAction, markOrderedAction, markReceivedAction } from "@/app/actions/procurement";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  request: { id: string; status: PurchaseStatus };
  canApprove: boolean;
}

export function RequestActions({ request, canApprove }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showDenyForm, setShowDenyForm] = useState(false);
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [denyReason, setDenyReason] = useState("");

  function run(fn: () => Promise<{ success: boolean; error?: string }>) {
    startTransition(async () => {
      const result = await fn();
      if (result.success) router.refresh();
    });
  }

  const { id, status } = request;

  return (
    <div className="flex flex-col gap-2 items-end shrink-0">
      {/* Approve / Deny */}
      {status === "SUBMITTED" && canApprove && !showDenyForm && !showOrderForm && (
        <div className="flex gap-2">
          <Button size="sm" onClick={() => run(() => approvePurchaseRequestAction(id))} isLoading={isPending}>
            Approve
          </Button>
          <Button size="sm" variant="danger" onClick={() => setShowDenyForm(true)}>Deny</Button>
        </div>
      )}

      {/* Deny form */}
      {showDenyForm && (
        <div className="w-64 card space-y-3">
          <Textarea
            label="Reason for denial"
            rows={2}
            value={denyReason}
            onChange={(e) => setDenyReason(e.target.value)}
            placeholder="Optional reason"
          />
          <div className="flex gap-2">
            <Button size="sm" variant="danger" isLoading={isPending}
              onClick={() => run(() => denyPurchaseRequestAction(id, denyReason))}>
              Confirm deny
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowDenyForm(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Mark as ordered */}
      {status === "APPROVED" && !showOrderForm && (
        <Button size="sm" variant="secondary" onClick={() => setShowOrderForm(true)}>
          Mark as ordered
        </Button>
      )}

      {showOrderForm && (
        <form
          className="w-72 card space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            run(() => markOrderedAction(id, fd));
            setShowOrderForm(false);
          }}
        >
          <p className="text-h3 text-[--color-text-primary]">Order details</p>
          <Field label="Confirmation #" name="orderConfirmation" placeholder="Order / invoice number" />
          <Field label="Actual total ($)" name="actualTotal" type="number" step="0.01" placeholder="0.00" />
          <Field label="Expected delivery" name="expectedDelivery" type="date" />
          <div className="flex gap-2">
            <Button type="submit" size="sm" isLoading={isPending}>Save</Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setShowOrderForm(false)}>Cancel</Button>
          </div>
        </form>
      )}

      {/* Mark as received */}
      {(status === "ORDERED" || status === "PARTIAL_RECEIVED") && (
        <Button size="sm" variant="outline"
          onClick={() => run(() => markReceivedAction(id))}
          isLoading={isPending}>
          Mark received
        </Button>
      )}
    </div>
  );
}
