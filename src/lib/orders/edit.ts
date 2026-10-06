// Editing an open order: its name and items. Server-only.
//
// Anyone who can approve or order it may edit (see canEditOrder). Arrived items are
// locked — their stock is already counted — so they can't be changed or removed.

import { prisma } from "@/lib/prisma";
import type { RequestPriority, SubTeam } from "@/generated/prisma";
import { definitionFor, canEditOrder, type Actor } from "@/lib/workflow/engine";
import { highestImportance, itemRef, type Importance } from "./constants";
import { assignItemNumbers } from "./numbers";
import { syncOrders } from "./items";
import type { NewItem } from "./create";

export type EditedItem = NewItem & { id?: string };

const EDITABLE_FIELDS = ["name", "vendorName", "partNumber", "vendorProductUrl", "unitCost", "quantity", "subTeam", "importance", "reasoning", "notes"] as const;

export async function editOrder(input: {
  actor:     Actor;
  requestId: string;
  name:      string;
  items:     EditedItem[];
}): Promise<{ success: true } | { success: false; error: string }> {
  const { actor, requestId } = input;

  const order = await prisma.purchaseRequest.findFirst({
    where:  { id: requestId, season: { teamId: actor.teamId } },
    select: {
      id: true, title: true, status: true, currentStepKey: true, workflowDefinitionId: true,
      lineItems: { select: { id: true, orderNumber: true, status: true, name: true, vendorName: true, partNumber: true,
        vendorProductUrl: true, unitCost: true, quantity: true, subTeam: true, importance: true, reasoning: true,
        notes: true, baseItemId: true } },
    },
  });
  if (!order) return { success: false, error: "Order not found." };

  const def = await definitionFor(order.workflowDefinitionId);
  if (!canEditOrder(def, order, actor.roles)) {
    return { success: false, error: "Only people who can approve or order this can edit it — and only while it's open." };
  }

  const name  = input.name.trim();
  const items = input.items.filter((i) => i.name.trim() && i.quantity > 0);
  const existing = new Map(order.lineItems.map((l) => [l.id, l]));
  const arrived  = order.lineItems.filter((l) => l.status === "ARRIVED");

  if (items.some((i) => i.id && !existing.has(i.id))) return { success: false, error: "An item no longer belongs to this order. Refresh and try again." };
  if (items.some((i) => i.id && existing.get(i.id)!.status === "ARRIVED")) return { success: false, error: "Arrived items can't be changed." };
  if (items.length + arrived.length === 0) return { success: false, error: "An order needs at least one item. Cancel it instead." };

  const keptIds = new Set(items.map((i) => i.id).filter(Boolean));
  const removed = order.lineItems.filter((l) => l.status !== "ARRIVED" && !keptIds.has(l.id));
  // New items join where the order is: still waiting on approval, or already approved
  const newStatus = order.status === "SUBMITTED" ? "QUEUED" : "TO_ORDER";

  const changes: string[] = [];
  if (name !== order.title) changes.push(`renamed it to "${name}"`);

  await prisma.$transaction(async (tx) => {
    for (const r of removed) {
      await tx.purchaseLineItem.delete({ where: { id: r.id } });
      // A restock for this inventory item goes back to the order queue
      if (r.baseItemId) {
        await tx.reorderRequest.updateMany({
          where: { purchaseRequestId: order.id, baseItemId: r.baseItemId },
          data:  { purchaseRequestId: null, status: "PENDING" },
        });
      }
    }
    if (removed.length) changes.push(`removed ${removed.map((r) => `${itemRef(r)} ${r.name}`).join(", ")}`);

    const changedRefs: string[] = [];
    const added: string[] = [];
    for (const i of items) {
      const data = {
        name:             i.name.trim(),
        vendorName:       i.vendorName?.trim() || null,
        partNumber:       i.partNumber?.trim() || null,
        vendorProductUrl: i.link?.trim() || null,
        unitCost:         i.unitCost ?? null,
        quantity:         i.quantity,
        lineTotal:        i.unitCost != null ? i.unitCost * i.quantity : null,
        subTeam:          (i.subTeam ?? null) as SubTeam | null,
        importance:       (i.importance ?? "ROUTINE") as RequestPriority,
        reasoning:        i.reasoning?.trim() || null,
        notes:            i.notes?.trim() || null,
      };
      if (i.id) {
        const before = existing.get(i.id)!;
        if (EDITABLE_FIELDS.some((f) => (before[f] ?? null) !== (data[f] ?? null))) {
          await tx.purchaseLineItem.update({ where: { id: i.id }, data });
          changedRefs.push(itemRef(before));
        }
      } else {
        const created = await tx.purchaseLineItem.create({ data: { ...data, requestId: order.id, status: newStatus } });
        added.push(created.id);
      }
    }
    if (changedRefs.length) changes.push(`changed ${changedRefs.join(", ")}`);

    if (added.length) {
      // Approved orders are final, so new items get their item IDs straight away
      const numbers = newStatus === "TO_ORDER" ? await assignItemNumbers(tx, actor.teamId, { itemIds: added }) : new Map<string, number>();
      const names = items.filter((i) => !i.id).map((i, idx) =>
        `${itemRef({ id: added[idx], orderNumber: numbers.get(added[idx]) ?? null })} ${i.name.trim()}`);
      changes.push(`added ${names.join(", ")}`);
    }

    // Order-level fields follow the items (they drive approval rules, reminders and the budget)
    const all = await tx.purchaseLineItem.findMany({
      where:  { requestId: order.id },
      select: { unitCost: true, quantity: true, importance: true, subTeam: true, reasoning: true },
    });
    const total    = all.reduce((s, l) => s + (l.unitCost ?? 0) * l.quantity, 0);
    const subTeams = [...new Set(all.map((l) => l.subTeam ?? null))];
    await tx.purchaseRequest.update({
      where: { id: order.id },
      data: {
        title:          name || order.title,
        estimatedTotal: total,
        priority:       highestImportance(all.map((l) => l.importance as Importance)) as RequestPriority,
        subTeam:        subTeams.length === 1 ? subTeams[0] : null,
        justification:  all.length === 1 ? all[0].reasoning ?? null : null,
      },
    });
    // Money already committed in the budget follows the new total until it's spent
    await tx.expense.updateMany({ where: { purchaseRequestId: order.id, isCommitment: true }, data: { amount: total } });

    if (changes.length) {
      await tx.purchaseRequestEvent.create({
        data: { requestId: order.id, action: "effect", actorId: actor.id, note: `${actor.name} edited the order: ${changes.join("; ")}.` },
      });
    }
  }, { timeout: 20_000 });

  // Removing the last item that wasn't ordered/arrived can complete a step
  await syncOrders([order.id], actor);
  return { success: true };
}
