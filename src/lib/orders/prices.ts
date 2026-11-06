// Checking an order's prices before buying: each item not yet ordered is looked up again from its link,
// and the Buyer sees what changed. Applying the new prices saves them in the order's history and tells
// everyone on the order. Server-only.

import { prisma } from "@/lib/prisma";
import type { Actor } from "@/lib/workflow/engine";
import { itemRef } from "./constants";
import { lookupProduct } from "./lookup";
import { syncOrderSpend } from "./spend";
import { tellParticipants } from "./edit";

export interface PriceCheck {
  id:       string;
  ref:      string;
  name:     string;
  quantity: number;
  /** What the order says now */
  oldPrice: number | null;
  /** What the store says now (null: couldn't read a price) */
  newPrice: number | null;
}

const OPEN = ["QUEUED", "TO_ORDER"];
const money = (v: number | null) => (v == null ? "no price" : `$${v.toFixed(2)}`);

/** Look up the current price of each item still to be ordered (with a link) */
export async function checkOrderPrices(teamId: string, requestId: string): Promise<{ success: true; items: PriceCheck[] } | { success: false; error: string }> {
  const order = await prisma.purchaseRequest.findFirst({
    where:  { id: requestId, season: { teamId } },
    select: { lineItems: { where: { status: { in: OPEN as never } }, select: { id: true, orderNumber: true, name: true, quantity: true, unitCost: true, vendorProductUrl: true } } },
  });
  if (!order) return { success: false, error: "Order not found." };
  const items = order.lineItems.filter((l) => l.vendorProductUrl).slice(0, 50);
  if (items.length === 0) return { success: false, error: "No items still to order have a link to check." };

  const out: PriceCheck[] = [];
  const queue = [...items];
  await Promise.all(Array.from({ length: Math.min(4, queue.length) }, async () => {
    for (let l = queue.shift(); l; l = queue.shift()) {
      let newPrice: number | null = null;
      try { newPrice = (await lookupProduct(l.vendorProductUrl!, { teamId })).unitCost ?? null; } catch { /* unreadable */ }
      out.push({ id: l.id, ref: itemRef(l), name: l.name, quantity: l.quantity, oldPrice: l.unitCost, newPrice: newPrice != null ? Math.round(newPrice * 100) / 100 : null });
    }
  }));
  out.sort((a, b) => a.ref.localeCompare(b.ref, undefined, { numeric: true }));
  return { success: true, items: out };
}

/** Save new prices for items still to be ordered; history + everyone on the order is told */
export async function applyOrderPrices(actor: Actor, requestId: string, prices: { id: string; unitCost: number }[]): Promise<{ success: true; count: number } | { success: false; error: string }> {
  const order = await prisma.purchaseRequest.findFirst({
    where:  { id: requestId, season: { teamId: actor.teamId } },
    select: { id: true, title: true, lineItems: { select: { id: true, orderNumber: true, name: true, quantity: true, unitCost: true, status: true } } },
  });
  if (!order) return { success: false, error: "Order not found." };
  const byId = new Map(order.lineItems.map((l) => [l.id, l]));
  const changes: string[] = [];
  const updates: { id: string; unitCost: number; quantity: number }[] = [];
  for (const p of prices) {
    const l = byId.get(p.id);
    if (!l) return { success: false, error: "An item no longer belongs to this order. Check the prices again." };
    if (!OPEN.includes(l.status)) return { success: false, error: `${itemRef(l)} ${l.name} is already ordered, so its price can't change.` };
    if (!(p.unitCost >= 0 && p.unitCost < 1_000_000)) return { success: false, error: "That isn't a price." };
    const cost = Math.round(p.unitCost * 100) / 100;
    if (cost === l.unitCost) continue;
    updates.push({ id: l.id, unitCost: cost, quantity: l.quantity });
    changes.push(`${itemRef(l)} ${l.name}: unit price ${money(l.unitCost)} → ${money(cost)}`);
  }
  if (updates.length === 0) return { success: true, count: 0 };

  await prisma.$transaction(async (tx) => {
    for (const u of updates) {
      await tx.purchaseLineItem.update({ where: { id: u.id }, data: { unitCost: u.unitCost, lineTotal: u.unitCost * u.quantity } });
    }
    const all = await tx.purchaseLineItem.findMany({ where: { requestId: order.id }, select: { unitCost: true, quantity: true } });
    const total = all.reduce((s, l) => s + (l.unitCost ?? 0) * l.quantity, 0);
    await tx.purchaseRequest.update({ where: { id: order.id }, data: { estimatedTotal: total } });
    // Money only committed (not yet spent) follows the new total
    const recorded = await tx.expense.findMany({ where: { purchaseRequestId: order.id }, select: { isCommitment: true } });
    if (recorded.length > 0 && recorded.every((e) => e.isCommitment)) await syncOrderSpend(tx, order.id, { amount: total });
    await tx.purchaseRequestEvent.create({
      data: { requestId: order.id, action: "effect", actorId: actor.id, note: `${actor.name} updated prices from the stores: ${changes.join("; ")}.` },
    });
  }, { timeout: 20_000 });

  await tellParticipants(order.id, actor, order.title, changes, "updated prices on");
  return { success: true, count: updates.length };
}
