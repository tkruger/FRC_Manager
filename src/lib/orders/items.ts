// Item-level order operations: tracking links, status changes, arrivals, CSV export.
// Server-only. Callers check who is allowed to do what; these enforce team scope.

import { prisma } from "@/lib/prisma";
import type { ItemCategory, OrderItemStatus, Prisma } from "@/generated/prisma";
import { definitionFor, resolveCurrentStep, performCurrentStepAction, type Actor } from "@/lib/workflow/engine";
import { itemRef } from "./constants";
import { assignItemNumbers } from "./numbers";

type Tx = Prisma.TransactionClient;

const ITEM_SELECT = {
  id: true, requestId: true, orderNumber: true, name: true, partNumber: true, vendorName: true,
  quantity: true, unitCost: true, subTeam: true, status: true, baseItemId: true,
  request: { select: { seasonId: true, title: true } },
} as const;

/** Items by id, limited to the caller's team. */
async function teamItems(teamId: string, itemIds: string[]) {
  return prisma.purchaseLineItem.findMany({
    where:  { id: { in: itemIds }, request: { season: { teamId } } },
    select: ITEM_SELECT,
  });
}

function isHttpUrl(v: string) {
  try { const u = new URL(v); return u.protocol === "https:" || u.protocol === "http:"; } catch { return false; }
}

async function logItemEvent(tx: Tx | typeof prisma, requestId: string, actorId: string, note: string) {
  await tx.purchaseRequestEvent.create({ data: { requestId, action: "effect", actorId, note } });
}

// ── Tracking ────────────────────────────────────────────────────────────────

/** One tracking link for many items (they shipped together); those items become Ordered. */
export async function addTracking(teamId: string, actor: Actor, itemIds: string[], url: string, label?: string) {
  const link = url.trim();
  if (!isHttpUrl(link)) return { success: false as const, error: "Enter a full tracking link (https://…)." };

  const items = (await teamItems(teamId, itemIds)).filter((i) => i.status === "TO_ORDER" || i.status === "ORDERED");
  if (items.length === 0) return { success: false as const, error: "Choose items that are To order or Ordered." };

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    const tracking = await tx.tracking.create({
      data: { teamId, url: link, label: label?.trim() || null, createdById: actor.id },
    });
    await tx.purchaseLineItem.updateMany({
      where: { id: { in: items.map((i) => i.id) } },
      data:  { trackingId: tracking.id, status: "ORDERED" },
    });
    await tx.purchaseLineItem.updateMany({
      where: { id: { in: items.map((i) => i.id) }, orderedAt: null },
      data:  { orderedAt: now },
    });
    for (const [requestId, group] of groupBy(items, (i) => i.requestId)) {
      await logItemEvent(tx, requestId, actor.id,
        `Ordered — tracking added for ${group.map((i) => itemRef(i)).join(", ")}.`);
    }
  });

  await syncOrders(items.map((i) => i.requestId), actor);
  return { success: true as const, count: items.length };
}

// ── Status changes ──────────────────────────────────────────────────────────

/**
 * Manual status change (captains / Team Admin). Setting Arrived stocks the item.
 * Arrived items stay arrived — their stock has already been added.
 */
export async function setItemStatus(teamId: string, actor: Actor, itemIds: string[], status: OrderItemStatus) {
  if (status === "ARRIVED") return markArrived(teamId, actor, itemIds, { allowQueued: true });

  const items = (await teamItems(teamId, itemIds)).filter((i) => i.status !== "ARRIVED");
  if (items.length === 0) return { success: false as const, error: "Arrived items can't be changed." };

  await prisma.$transaction(async (tx) => {
    await tx.purchaseLineItem.updateMany({
      where: { id: { in: items.map((i) => i.id) } },
      data:  { status, ...(status === "ORDERED" ? { orderedAt: new Date() } : {}) },
    });
    // Moved past Queued by hand: drafts get their item IDs now
    if (status !== "QUEUED") await numberDrafts(tx, teamId, items);
    for (const [requestId, group] of groupBy(items, (i) => i.requestId)) {
      await logItemEvent(tx, requestId, actor.id,
        `Status set to ${status.replace("_", " ").toLowerCase()} for ${group.map((i) => itemRef(i)).join(", ")}.`);
    }
  });

  await syncOrders(items.map((i) => i.requestId), actor);
  return { success: true as const, count: items.length };
}

/** Give draft items their item IDs, and update the loaded rows to match. */
async function numberDrafts(tx: Tx, teamId: string, items: { id: string; orderNumber: number | null }[]) {
  const drafts = items.filter((i) => i.orderNumber == null);
  if (drafts.length === 0) return;
  const numbers = await assignItemNumbers(tx, teamId, { itemIds: drafts.map((i) => i.id) });
  for (const i of drafts) i.orderNumber = numbers.get(i.id) ?? null;
}

/** Mark items arrived: each is added to inventory and set to Arrived. */
export async function markArrived(teamId: string, actor: Actor, itemIds: string[], opts: { allowQueued?: boolean } = {}) {
  const items = (await teamItems(teamId, itemIds)).filter((i) =>
    i.status === "TO_ORDER" || i.status === "ORDERED" || (opts.allowQueued && i.status === "QUEUED"));
  if (items.length === 0) {
    return { success: false as const, error: "Only approved items (To order or Ordered) can be marked arrived." };
  }

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await numberDrafts(tx, teamId, items);
    for (const item of items) {
      const stocked = await stockItem(tx, item);
      await tx.purchaseLineItem.update({
        where: { id: item.id },
        data:  { status: "ARRIVED", arrivedAt: now, arrivedById: actor.id, qtyReceived: item.quantity, baseItemId: stocked.id },
      });
      await logItemEvent(tx, item.requestId, actor.id,
        `${itemRef(item)} ${item.name} arrived — ${item.quantity} ${stocked.created ? "added to inventory as a new item" : "added to inventory stock"}.`);
    }
  }, { timeout: 20_000 });

  await syncOrders(items.map((i) => i.requestId), actor);
  return { success: true as const, count: items.length };
}

const CATEGORY_BY_SUBTEAM: Partial<Record<string, ItemCategory>> = {
  ELECTRICAL:  "ELECTRICAL",
  PROGRAMMING: "ELECTRONICS",
  MECHANICAL:  "MECHANICAL",
};

/** Add an arrived item's quantity to inventory, finding or creating the inventory item. */
async function stockItem(tx: Tx, item: Awaited<ReturnType<typeof teamItems>>[number]) {
  const seasonId = item.request.seasonId;
  const existing =
    (item.baseItemId && await tx.baseInventoryItem.findFirst({ where: { id: item.baseItemId, seasonId }, select: { id: true } })) ||
    (item.partNumber && await tx.baseInventoryItem.findFirst({
      where:  { seasonId, archived: false, partNumber: { equals: item.partNumber, mode: "insensitive" } },
      select: { id: true },
    })) ||
    await tx.baseInventoryItem.findFirst({
      where:  { seasonId, archived: false, name: { equals: item.name, mode: "insensitive" } },
      select: { id: true },
    });

  if (existing) {
    await tx.baseInventoryItem.update({ where: { id: existing.id }, data: { currentStock: { increment: item.quantity } } });
    return { id: existing.id, created: false };
  }
  const created = await tx.baseInventoryItem.create({
    data: {
      seasonId,
      name:              item.name,
      partNumber:        item.partNumber,
      category:          CATEGORY_BY_SUBTEAM[item.subTeam ?? ""] ?? "HARDWARE",
      currentStock:      item.quantity,
      unitCost:          item.unitCost,
      preferredSupplier: item.vendorName,
      notes:             `Added when order item ${itemRef(item)} arrived ("${item.request.title}").`,
    },
    select: { id: true },
  });
  return { id: created.id, created: true };
}

// ── Keep each order's workflow step in line with its items ──────────────────

/**
 * Orders sit on the "order" step until every item is ordered, and on the
 * "receive" step until every item has arrived; then they move on by themselves.
 */
export async function syncOrders(requestIds: string[], actor: Actor) {
  for (const requestId of new Set(requestIds)) {
    for (let pass = 0; pass < 2; pass++) {
      const r = await prisma.purchaseRequest.findUnique({
        where:  { id: requestId },
        select: { status: true, currentStepKey: true, workflowDefinitionId: true, lineItems: { select: { status: true } } },
      });
      if (!r || r.lineItems.length === 0) break;
      const step = resolveCurrentStep(await definitionFor(r.workflowDefinitionId), r);
      const statuses = r.lineItems.map((l) => l.status);
      const allOrdered = statuses.every((s) => s === "ORDERED" || s === "ARRIVED");
      const allArrived = statuses.every((s) => s === "ARRIVED");

      if (step?.type === "order" && allOrdered) {
        await performCurrentStepAction(requestId, "order", actor, {}, { system: true });
      } else if (step?.type === "receive" && allArrived) {
        await performCurrentStepAction(requestId, "receive", actor, {}, { system: true });
      } else {
        break;
      }
    }
  }
}

// ── CSV for the Team Admin ──────────────────────────────────────────────────

function csvCell(v: unknown): string {
  const s = String(v ?? "");
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Fields needed for one CSV row */
export const CSV_ITEM_SELECT = {
  id: true, orderNumber: true, vendorName: true, name: true, vendorProductUrl: true,
  unitCost: true, quantity: true, notes: true, request: { select: { submittedAt: true } },
} satisfies Prisma.PurchaseLineItemSelect;

type CsvItem = Prisma.PurchaseLineItemGetPayload<{ select: typeof CSV_ITEM_SELECT }>;

/**
 * The purchasing spreadsheet's format — no header row, one item per line, grouped by vendor:
 * #XXXX (item ID), Vendor, Part Name, Link, Unit Price, Qty, Order Notes, Order Date.
 * Items on orders that aren't approved yet have a draft ID (DRAFT-7K2Q) instead.
 * Used by the Team Admin export and the order exports, so they always match.
 */
export function itemsToCsv(items: CsvItem[]): string {
  return [...items].sort(byVendor).map((i) => [
    i.orderNumber != null ? `#${itemRef(i)}` : itemRef(i),
    i.vendorName ?? "",
    i.name,
    i.vendorProductUrl ?? "",
    i.unitCost != null ? i.unitCost.toFixed(2) : "",
    i.quantity,
    i.notes ?? "",
    i.request.submittedAt.toISOString().slice(0, 10),
  ].map(csvCell).join(",")).join("\n");
}

/** Vendor A→Z (no vendor last), then item ID, drafts after numbered items */
function byVendor(a: CsvItem, b: CsvItem): number {
  const va = a.vendorName?.trim() ?? "", vb = b.vendorName?.trim() ?? "";
  if (!va !== !vb) return va ? -1 : 1;
  return va.localeCompare(vb, undefined, { sensitivity: "base" })
    || (a.orderNumber ?? Infinity) - (b.orderNumber ?? Infinity)
    || a.id.localeCompare(b.id);
}

/** "To order" items for the Team Admin, in the spreadsheet format above. */
export async function toOrderCsv(teamId: string, opts: { itemIds?: string[]; onlyNew?: boolean; markExported?: boolean }) {
  const items = await prisma.purchaseLineItem.findMany({
    where: {
      status:  "TO_ORDER",
      request: { season: { teamId } },
      ...(opts.itemIds?.length ? { id: { in: opts.itemIds } } : {}),
      ...(opts.onlyNew ? { exportedAt: null } : {}),
    },
    select:  CSV_ITEM_SELECT,
    orderBy: { orderNumber: "asc" },
  });

  const csv = itemsToCsv(items);

  if (opts.markExported && items.length) {
    await prisma.purchaseLineItem.updateMany({ where: { id: { in: items.map((i) => i.id) } }, data: { exportedAt: new Date() } });
  }
  return { csv, count: items.length };
}

function groupBy<T>(list: T[], key: (t: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const t of list) m.set(key(t), [...(m.get(key(t)) ?? []), t]);
  return m;
}
