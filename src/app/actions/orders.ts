"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import type { Actor } from "@/lib/workflow/engine";
import { createOrder } from "@/lib/orders/create";
import { editOrder } from "@/lib/orders/edit";
import { addTracking, setItemStatus, markArrived, toOrderCsv } from "@/lib/orders/items";
import { lookupProduct, type ProductInfo } from "@/lib/orders/lookup";
import { ORDER_ADMIN_ROLES, STATUS_OVERRIDE_ROLES } from "@/lib/orders/constants";
import { createExportToken } from "@/lib/orders/export-token";

type Result<T = object> = ({ success: true } & T) | { success: false; error: string };

async function actor(): Promise<Actor | null> {
  const session = await auth();
  if (!session?.user?.teamId) return null;
  return { id: session.user.id, name: session.user.name, roles: session.user.roles, teamId: session.user.teamId };
}

function refresh(requestIds: string[] = []) {
  revalidatePath("/procurement", "layout");
  revalidatePath("/inventory");
  revalidatePath("/budget");
  for (const id of requestIds) revalidatePath(`/procurement/requests/${id}`);
}

// ── New order ────────────────────────────────────────────────────────────────

const ItemSchema = z.object({
  name:       z.string().trim().min(1, "Every item needs a name.").max(200),
  vendorName: z.string().trim().max(120).optional(),
  partNumber: z.string().trim().max(120).optional(),
  link:       z.string().trim().max(2000).optional(),
  unitCost:   z.number().min(0).max(1_000_000).nullable().optional(),
  quantity:   z.number().positive("Quantity must be more than 0.").max(100_000),
  subTeam:    z.enum(["MECHANICAL", "ELECTRICAL", "PROGRAMMING", "DRIVE_TEAM", "STRATEGY", "DESIGN", "OUTREACH", "OPERATIONS"]).nullable().optional(),
  importance: z.enum(["ROUTINE", "URGENT", "EMERGENCY"]).default("ROUTINE"),
  reasoning:  z.string().trim().max(2000).optional(),
  notes:      z.string().trim().max(2000).optional(),
});

const OrderSchema = z.object({
  name:    z.string().trim().min(1, "Give the order a name.").max(120),
  items:   z.array(ItemSchema).min(1, "Add at least one item.").max(100),
  /** Submitting a saved draft removes it */
  draftId: z.string().nullable().optional(),
});

export async function createOrderAction(input: unknown): Promise<Result<{ requestId: string; stage: string }>> {
  const who = await actor();
  if (!who) return { success: false, error: "Not authenticated." };

  const parsed = OrderSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Please check the order." };

  const season = await prisma.season.findFirst({ where: { teamId: who.teamId, isActive: true }, select: { id: true } });
  if (!season) return { success: false, error: "No active season. Set up a season first." };

  const res = await createOrder({ actor: who, seasonId: season.id, name: parsed.data.name, items: parsed.data.items });
  if (res.success) {
    if (parsed.data.draftId) await prisma.orderDraft.deleteMany({ where: { id: parsed.data.draftId, userId: who.id } });
    refresh([res.requestId]);
  }
  return res;
}

// ── Drafts ──────────────────────────────────────────────────────────────────

// Drafts hold the form as typed, so fields are loose strings; they're checked on submit
const DraftSchema = z.object({
  draftId: z.string().nullable().optional(),
  name:    z.string().max(120),
  items:   z.array(z.object({
    link: z.string().max(2000), vendorName: z.string().max(120), name: z.string().max(200), partNumber: z.string().max(120),
    unitCost: z.string().max(20), quantity: z.string().max(20), subTeam: z.string().max(40), importance: z.string().max(20),
    reasoning: z.string().max(2000), notes: z.string().max(2000),
  })).max(100),
});

/** Save an in-progress order (private to its author). Creates it the first time. */
export async function saveOrderDraftAction(input: unknown): Promise<Result<{ draftId: string }>> {
  const who = await actor();
  if (!who) return { success: false, error: "Not authenticated." };
  const parsed = DraftSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Couldn't save this draft." };

  const { draftId, items } = parsed.data;
  const name = parsed.data.name.trim() || "Untitled order";
  if (draftId) {
    const updated = await prisma.orderDraft.updateMany({ where: { id: draftId, userId: who.id }, data: { name, items } });
    if (updated.count === 1) { revalidatePath("/procurement"); return { success: true, draftId }; }
    // Deleted meanwhile (or someone else's id) — save as a new draft instead
  }
  const created = await prisma.orderDraft.create({ data: { teamId: who.teamId, userId: who.id, name, items } });
  revalidatePath("/procurement");
  return { success: true, draftId: created.id };
}

export async function deleteOrderDraftAction(draftId: string): Promise<Result> {
  const who = await actor();
  if (!who) return { success: false, error: "Not authenticated." };
  await prisma.orderDraft.deleteMany({ where: { id: draftId, userId: who.id } });
  revalidatePath("/procurement");
  return { success: true };
}

// ── Edit order ──────────────────────────────────────────────────────────────

const EditOrderSchema = z.object({
  requestId: z.string().min(1),
  name:      z.string().trim().min(1, "Give the order a name.").max(120),
  // Arrived items aren't sent (they're locked), so an order may come back with none here
  items:     z.array(ItemSchema.extend({ id: z.string().optional() })).max(100),
});

/** Anyone who can approve or order this order (and Head Mentors) — checked in editOrder. */
export async function editOrderAction(input: unknown): Promise<Result> {
  const who = await actor();
  if (!who) return { success: false, error: "Not authenticated." };

  const parsed = EditOrderSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Please check the order." };

  const res = await editOrder({ actor: who, ...parsed.data });
  if (res.success) refresh([parsed.data.requestId]);
  return res;
}

export async function lookupProductAction(url: string): Promise<Result<{ product: ProductInfo }>> {
  if (!await actor()) return { success: false, error: "Not authenticated." };
  try {
    new URL(url);
  } catch {
    return { success: false, error: "That doesn't look like a link." };
  }
  try {
    return { success: true, product: await lookupProduct(url) };
  } catch {
    return { success: false, error: "Couldn't read that page — fill the details in by hand." };
  }
}

// ── Item updates ─────────────────────────────────────────────────────────────

const Ids = z.array(z.string().min(1)).min(1).max(500);

async function requestIdsFor(itemIds: string[]) {
  return [...new Set((await prisma.purchaseLineItem.findMany({ where: { id: { in: itemIds } }, select: { requestId: true } })).map((i) => i.requestId))];
}

export async function addTrackingAction(itemIds: string[], url: string, label?: string): Promise<Result<{ count: number }>> {
  const who = await actor();
  if (!who) return { success: false, error: "Not authenticated." };
  if (!who.roles.some((r) => ORDER_ADMIN_ROLES.includes(r))) return { success: false, error: "Only the Team Admin or captains can add tracking links." };
  if (!Ids.safeParse(itemIds).success) return { success: false, error: "Choose at least one item." };

  const res = await addTracking(who.teamId, who, itemIds, url, label);
  if (res.success) refresh(await requestIdsFor(itemIds));
  return res;
}

export async function setItemStatusAction(itemIds: string[], status: string): Promise<Result<{ count: number }>> {
  const who = await actor();
  if (!who) return { success: false, error: "Not authenticated." };
  if (!who.roles.some((r) => STATUS_OVERRIDE_ROLES.includes(r))) return { success: false, error: "Only the Team Admin or captains can change an item's status." };
  if (!Ids.safeParse(itemIds).success) return { success: false, error: "Choose at least one item." };
  const s = z.enum(["QUEUED", "TO_ORDER", "ORDERED", "ARRIVED"]).safeParse(status);
  if (!s.success) return { success: false, error: "Unknown status." };

  const res = await setItemStatus(who.teamId, who, itemIds, s.data);
  if (res.success) refresh(await requestIdsFor(itemIds));
  return res;
}

/** Anyone on the team can mark items arrived when the box shows up. */
export async function markArrivedAction(itemIds: string[]): Promise<Result<{ count: number }>> {
  const who = await actor();
  if (!who) return { success: false, error: "Not authenticated." };
  if (!Ids.safeParse(itemIds).success) return { success: false, error: "Choose at least one item." };

  const res = await markArrived(who.teamId, who, itemIds);
  if (res.success) refresh(await requestIdsFor(itemIds));
  return res;
}

export async function exportToOrderCsvAction(opts: { itemIds?: string[]; onlyNew?: boolean }): Promise<Result<{ csv: string; count: number }>> {
  const who = await actor();
  if (!who) return { success: false, error: "Not authenticated." };
  if (!who.roles.some((r) => ORDER_ADMIN_ROLES.includes(r))) return { success: false, error: "Only the Team Admin or captains can export orders." };

  const res = await toOrderCsv(who.teamId, { itemIds: opts.itemIds, onlyNew: opts.onlyNew, markExported: true });
  refresh();
  return { success: true, ...res };
}

/**
 * A short-lived link to a CSV export that works without a login — the iPhone
 * home-screen app opens it in Safari, which can download files.
 */
export async function createOrderExportLinkAction(scope: { order?: string; view?: string }): Promise<Result<{ path: string }>> {
  const who = await actor();
  if (!who) return { success: false, error: "Not authenticated." };

  const view = z.enum(["open", "mine", "all"]).catch("open").parse(scope.view);
  if (scope.order) {
    const owned = await prisma.purchaseRequest.findFirst({
      where: { id: scope.order, season: { teamId: who.teamId } }, select: { id: true },
    });
    if (!owned) return { success: false, error: "Order not found." };
  }
  const token = createExportToken({ userId: who.id, teamId: who.teamId, ...(scope.order ? { order: scope.order } : { view }) });
  return { success: true, path: `/api/orders/csv?token=${encodeURIComponent(token)}` };
}
