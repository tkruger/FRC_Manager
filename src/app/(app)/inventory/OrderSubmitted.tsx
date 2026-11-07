"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { PurchaseRequestState } from "@/app/actions/procurement";

/** Shown in place of an order form once the order exists — or the item was added to a draft. */
export function OrderSubmitted({
  state, itemName, onDone,
}: { state: Extract<PurchaseRequestState, { success: true }>; itemName: string; onDone: () => void }) {
  if ("draft" in state) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-(--color-success) bg-(--color-success)/10 px-4 py-3 space-y-1">
          <p className="text-sm font-semibold text-(--color-text-primary)">✓ Added to your draft</p>
          <p className="text-small text-(--color-text-secondary)">
            {itemName} is in “{state.draft.name}” ({state.draft.items} {state.draft.items === 1 ? "item" : "items"}). It isn&apos;t sent
            until you submit the draft — find it under Orders.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/procurement/requests/new?draft=${state.draft.id}`}>
            <Button type="button">Open the draft</Button>
          </Link>
          <Button type="button" variant="outline" onClick={onDone}>Done</Button>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-(--color-success) bg-(--color-success)/10 px-4 py-3 space-y-1">
        <p className="text-sm font-semibold text-(--color-text-primary)">✓ Order created</p>
        <p className="text-small text-(--color-text-secondary)">
          {itemName} is in the order queue. {state.stage}.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href={`/procurement/requests/${state.requestId}`}>
          <Button type="button">View order</Button>
        </Link>
        <Button type="button" variant="outline" onClick={onDone}>Done</Button>
      </div>
    </div>
  );
}
