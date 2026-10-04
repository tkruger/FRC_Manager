// Low-stock trigger — the first stage of the purchase workflow. Server-only.

import { prisma } from "@/lib/prisma";
import { notifyTeam } from "@/lib/notifications";
import { getActiveWorkflow } from "./engine";

/**
 * Queue a reorder when an item's stock falls to/below its minimum, if the team's
 * workflow has auto-reorder on and the item isn't already queued or on order.
 */
export async function maybeQueueReorder(
  item: { id: string; name: string; minStockThreshold: number; reorderQuantity: number },
  newStock: number,
  teamId: string,
): Promise<void> {
  if (item.minStockThreshold <= 0 || newStock > item.minStockThreshold) return;

  const { def } = await getActiveWorkflow(teamId);
  if (!def.trigger.autoReorder) return;

  const open = await prisma.reorderRequest.findFirst({
    where: { baseItemId: item.id, status: { in: ["PENDING", "APPROVED", "ORDERED"] } },
    select: { id: true },
  });
  if (open) return;

  await prisma.reorderRequest.create({
    data: { baseItemId: item.id, requestedQty: item.reorderQuantity },
  });

  if (def.trigger.notifyRoles.length > 0) {
    await notifyTeam({
      teamId,
      roles:   def.trigger.notifyRoles,
      type:    "REORDER_TRIGGERED",
      topic:   "inventory.low_stock",
      title:   `Low stock: ${item.name}`,
      body:    `${newStock} left (minimum ${item.minStockThreshold}) — added to the reorder queue`,
      linkUrl: "/inventory?view=reorder",
    }).catch(() => {});
  }
}
