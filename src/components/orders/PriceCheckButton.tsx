"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { formatCurrency } from "@/lib/utils";
import { applyOrderPricesAction, checkOrderPricesAction } from "@/app/actions/orders";
import type { PriceCheck } from "@/lib/orders/prices";

/**
 * Buyer: before placing an order, look up each item's price on its store again and see what changed.
 * Accepting saves the new prices (in the order's history, and everyone on the order is told).
 */
export function PriceCheckButton({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<PriceCheck[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, startCheck] = useTransition();
  const [saving, startSave] = useTransition();

  const changed = (items ?? []).filter((i) => i.newPrice != null && i.newPrice !== i.oldPrice);
  const unread = (items ?? []).filter((i) => i.newPrice == null);
  const before = changed.reduce((s, i) => s + (i.oldPrice ?? 0) * i.quantity, 0);
  const after = changed.reduce((s, i) => s + (i.newPrice ?? 0) * i.quantity, 0);

  function check() {
    setOpen(true); setItems(null); setError(null);
    startCheck(async () => {
      const res = await checkOrderPricesAction(requestId);
      if (!res.success) { setError(res.error); return; }
      setItems(res.items);
    });
  }

  function apply() {
    startSave(async () => {
      const res = await applyOrderPricesAction(requestId, changed.map((i) => ({ id: i.id, unitCost: i.newPrice! })));
      if (!res.success) { toast.error(res.error); return; }
      toast.success(`Updated ${res.count} price${res.count === 1 ? "" : "s"} — everyone on the order was told`);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={check} title="Look up each item's price on its store again">
        <RefreshCw className="h-4 w-4" aria-hidden /> Check prices
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title="Check prices" description="Each item still to order, looked up again on its store.">
          {checking || (!items && !error) ? (
            <p className="flex items-center gap-2 text-sm text-(--color-text-secondary)"><RefreshCw className="h-4 w-4 animate-spin" aria-hidden /> Checking the stores…</p>
          ) : error ? (
            <p className="text-sm text-(--color-danger)">{error}</p>
          ) : (
            <div className="space-y-4">
              {changed.length === 0 ? (
                <p className="rounded-md bg-(--color-success)/10 px-3 py-2 text-sm text-(--color-success)">✓ No price changes{unread.length ? " on the items that could be checked" : ""}.</p>
              ) : (
                <>
                  <ul className="divide-y divide-(--color-border) rounded-md border border-(--color-border)">
                    {changed.map((i) => {
                      const up = (i.newPrice ?? 0) > (i.oldPrice ?? 0);
                      return (
                        <li key={i.id} className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-2 text-sm">
                          <span className="min-w-0 text-(--color-text-primary)"><span className="mr-1.5 font-mono text-xs text-(--color-text-secondary)">{i.ref}</span>{i.name}</span>
                          <span className="whitespace-nowrap">
                            <span className="text-(--color-text-secondary) line-through">{i.oldPrice != null ? formatCurrency(i.oldPrice) : "no price"}</span>
                            {" → "}
                            <b className={up ? "text-(--color-danger)" : "text-(--color-success)"}>{formatCurrency(i.newPrice!)}</b>
                            <span className="text-(--color-text-secondary)"> × {i.quantity}</span>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                  <p className="text-sm text-(--color-text-primary)">
                    These items: {formatCurrency(before)} → <b>{formatCurrency(after)}</b>{" "}
                    <span className={after > before ? "text-(--color-danger)" : "text-(--color-success)"}>
                      ({after >= before ? "+" : "−"}{formatCurrency(Math.abs(after - before))})
                    </span>
                  </p>
                </>
              )}
              {unread.length > 0 && (
                <p className="text-small text-(--color-text-secondary)">
                  Couldn&apos;t read a price for {unread.map((i) => i.ref).join(", ")} — some stores block it. Check {unread.length === 1 ? "that one" : "those"} by hand.
                </p>
              )}
              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="outline" onClick={() => setOpen(false)}>{changed.length ? "Keep old prices" : "Close"}</Button>
                {changed.length > 0 && <Button isLoading={saving} onClick={apply}>Update {changed.length} price{changed.length === 1 ? "" : "s"}</Button>}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
