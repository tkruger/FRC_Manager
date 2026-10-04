"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

/** Shown in place of an order form once the purchase request exists. */
export function OrderSubmitted({
  requestId, stage, itemName, onDone,
}: { requestId: string; stage: string; itemName: string; onDone: () => void }) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-(--color-success) bg-(--color-success)/10 px-4 py-3 space-y-1">
        <p className="text-sm font-semibold text-(--color-text-primary)">✓ Purchase request created</p>
        <p className="text-small text-(--color-text-secondary)">
          {itemName} is in the order queue. {stage}.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href={`/procurement/requests/${requestId}`}>
          <Button type="button">View request</Button>
        </Link>
        <Button type="button" variant="outline" onClick={onDone}>Done</Button>
      </div>
    </div>
  );
}
