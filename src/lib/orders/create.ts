// Creating orders. Server-only — used by the order form, inventory "Order" buttons
// and Discord /order request, so every path assigns item IDs and queue entries the same way.

import { prisma } from "@/lib/prisma";
import type { RequestPriority, SubTeam } from "@/generated/prisma";
import { startWorkflow, describeRequestState, type Actor } from "@/lib/workflow/engine";
import { highestImportance, type Importance } from "./constants";

export interface NewItem {
  name:        string;
  vendorName?: string | null;
  partNumber?: string | null;   // vendor part number
  link?:       string | null;
  unitCost?:   number | null;
  quantity:    number;
  subTeam?:    SubTeam | null;
  importance?: Importance;
  reasoning?:  string | null;
  notes?:      string | null;
  /** Restocks this inventory item when it arrives */
  baseItemId?: string | null;
}

export type CreateOrderResult =
  | { success: true; requestId: string; stage: string }
  | { success: false; error: string };

/** Reserve `count` sequential item IDs for the team (0001, 0002, …). Returns the first. */
async function reserveItemNumbers(teamId: string, count: number): Promise<number> {
  const { nextOrderItemNumber } = await prisma.team.update({
    where:  { id: teamId },
    data:   { nextOrderItemNumber: { increment: count } },
    select: { nextOrderItemNumber: true },
  });
  return nextOrderItemNumber - count;
}

export async function createOrder(input: {
  actor:    Actor;
  seasonId: string;
  name:     string;
  items:    NewItem[];
}): Promise<CreateOrderResult> {
  const { actor, seasonId, name } = input;
  const items = input.items.filter((i) => i.name.trim() && i.quantity > 0);
  if (items.length === 0) return { success: false, error: "Add at least one item." };

  // Only link items to inventory items that belong to this season
  const requestedItemIds = [...new Set(items.map((i) => i.baseItemId).filter((id): id is string => !!id))];
  const validItemIds = new Set(
    requestedItemIds.length === 0 ? [] : (await prisma.baseInventoryItem.findMany({
      where:  { id: { in: requestedItemIds }, seasonId },
      select: { id: true },
    })).map((b) => b.id)
  );

  // Don't raise a second order for an inventory item that's already on its way
  if (validItemIds.size > 0) {
    const onOrder = await prisma.reorderRequest.findFirst({
      where: {
        baseItemId:      { in: [...validItemIds] },
        purchaseRequest: { status: { in: ["SUBMITTED", "APPROVED", "ORDERED", "PARTIAL_RECEIVED"] } },
      },
      select: { baseItem: { select: { name: true } }, purchaseRequest: { select: { title: true } } },
    });
    if (onOrder) {
      return {
        success: false,
        error: `${onOrder.baseItem.name} is already on an open order ("${onOrder.purchaseRequest?.title}"). Find it in the order queue.`,
      };
    }
  }

  const importance = items.map((i) => i.importance ?? "ROUTINE");
  const subTeams   = [...new Set(items.map((i) => i.subTeam ?? null))];
  const total      = items.reduce((sum, i) => sum + (i.unitCost ?? 0) * i.quantity, 0);
  const firstNumber = await reserveItemNumbers(actor.teamId, items.length);

  const request = await prisma.purchaseRequest.create({
    data: {
      seasonId,
      title:          name.trim(),
      requestedById:  actor.id,
      // Order-level fields drive workflow conditions and reminders
      priority:       highestImportance(importance) as RequestPriority,
      subTeam:        subTeams.length === 1 ? subTeams[0] : null,
      justification:  items.length === 1 ? items[0].reasoning ?? null : null,
      estimatedTotal: total,
      status:         "SUBMITTED",
      lineItems: {
        create: items.map((i, idx) => ({
          orderNumber:      firstNumber + idx,
          name:             i.name.trim(),
          vendorName:       i.vendorName?.trim() || null,
          partNumber:       i.partNumber?.trim() || null,
          vendorProductUrl: i.link?.trim() || null,
          unitCost:         i.unitCost ?? null,
          quantity:         i.quantity,
          lineTotal:        i.unitCost != null ? i.unitCost * i.quantity : null,
          subTeam:          i.subTeam ?? null,
          importance:       (i.importance ?? "ROUTINE") as RequestPriority,
          reasoning:        i.reasoning?.trim() || null,
          notes:            i.notes?.trim() || null,
          baseItemId:       i.baseItemId && validItemIds.has(i.baseItemId) ? i.baseItemId : null,
        })),
      },
    },
  });

  // Every linked inventory item shows in the order queue until it arrives
  for (const itemId of validItemIds) {
    const qty = items.filter((i) => i.baseItemId === itemId).reduce((n, i) => n + i.quantity, 0);
    const open = await prisma.reorderRequest.findFirst({
      where:   { baseItemId: itemId, status: "PENDING", purchaseRequestId: null },
      orderBy: { createdAt: "asc" },
      select:  { id: true },
    });
    if (open) {
      await prisma.reorderRequest.update({ where: { id: open.id }, data: { purchaseRequestId: request.id, requestedQty: qty } });
    } else {
      await prisma.reorderRequest.create({ data: { baseItemId: itemId, requestedQty: qty, purchaseRequestId: request.id } });
    }
  }

  // Approval steps, notifications; once approved, items move to "To order"
  await startWorkflow(request.id, actor);

  return { success: true, requestId: request.id, stage: await describeRequestState(request.id) };
}
