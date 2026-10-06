"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { retireItemAction, restoreItemAction } from "@/app/actions/inventory";

/** Retire an item (remove it from inventory) or bring a retired one back. */
export function RetireItemButton({ itemId, itemName, retired }: { itemId: string; itemName: string; retired: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function run() {
    if (!retired && !confirm(`Retire "${itemName}"? It's removed from the inventory, low stock and the order queue. You can restore it later from "Show retired items".`)) return;
    start(async () => {
      const res = retired ? await restoreItemAction(itemId) : await retireItemAction(itemId);
      if (!res.success) { toast.error(res.error ?? "Something went wrong."); return; }
      toast.success(retired ? `${itemName} restored to the inventory` : `${itemName} retired`);
      router.refresh();
    });
  }

  return (
    <Button type="button" size="sm" variant={retired ? "primary" : "outline"} isLoading={pending} onClick={run}>
      {retired ? "Restore item" : "Retire item"}
    </Button>
  );
}
