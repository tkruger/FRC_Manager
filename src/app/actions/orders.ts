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
import { syncOrderSpend, canSetOrderBudget } from "@/lib/orders/spend";
import { definitionFor, canEditOrder } from "@/lib/workflow/engine";
import { BUDGET_CATEGORY_LABELS } from "@/lib/budget-categories";
import { ORDER_BUDGET_CATEGORIES } from "@/lib/budget-categories";
import type { BudgetCategoryType } from "@/generated/prisma";
import { issueMessage } from "@/lib/validation";

const CATEGORIES = ORDER_BUDGET_CATEGORIES as [BudgetCategoryType, ...BudgetCategoryType[]];
/** An order's budget category (required) */
const OrderBudgetCategory = z.enum(CATEGORIES, { error: "Choose a budget category for the order." });
/** An item's own budget category (optional) */
const BudgetCategory = z.enum(CATEGORIES);

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
  name:       z.string().trim().max(300).min(1, "Every item needs a name.").max(200),
  vendorName: z.string().trim().max(300).max(120).optional(),
  partNumber: z.string().trim().max(300).max(120).optional(),
  link:       z.string().trim().max(2000).optional(),
  unitCost:   z.number().min(0).max(1_000_000).nullable().optional(),
  quantity:   z.number().positive("Quantity must be more than 0.").max(100_000),
  subTeam:    z.enum(["MECHANICAL", "ELECTRICAL", "PROGRAMMING", "DRIVE_TEAM", "STRATEGY", "DESIGN", "OUTREACH", "OPERATIONS"]).nullable().optional(),
  importance: z.enum(["ROUTINE", "URGENT", "EMERGENCY"]).default("ROUTINE"),
  reasoning:  z.string().trim().max(5000).max(2000).optional(),
  notes:      z.string().trim().max(5000).max(2000).optional(),
  /** Charge this item to another budget category than the order's */
  budgetCategory: BudgetCategory.nullable().optional(),
});

const OrderSchema = z.object({
  name:    z.string().trim().max(300).min(1, "Give the order a name.").max(120),
  budgetCategory: OrderBudgetCategory,
  items:   z.array(ItemSchema).min(1, "Add at least one item.").max(100),
  /** Submitting a saved draft removes it */
  draftId: z.string().max(300).nullable().optional(),
});

/** Field names in order errors: "Item 2 (“Swerve module”): Link" */
const ITEM_FIELDS: Record<string, string> = {
  name: "Name", vendorName: "Vendor", partNumber: "Part number", link: "Link", unitCost: "Unit cost",
  quantity: "Quantity", subTeam: "Sub-team", importance: "Importance", reasoning: "Reasoning", notes: "Notes",
  budgetCategory: "Budget category",
};
function orderLabel(input: unknown) {
  return (path: PropertyKey[]): string | null => {
    if (path[0] === "items" && typeof path[1] === "number") {
      const item = (input as { items?: { name?: unknown }[] } | null)?.items?.[path[1]];
      const itemName = typeof item?.name === "string" && item.name.trim() ? ` (“${item.name.trim().slice(0, 40)}”)` : "";
      return `Item ${path[1] + 1}${itemName}: ${ITEM_FIELDS[String(path[2])] ?? "This field"}`;
    }
    if (path[0] === "name") return "Order name";
    if (path[0] === "budgetCategory") return "Budget category";
    return null;
  };
}

export async function createOrderAction(input: unknown): Promise<Result<{ requestId: string; stage: string }>> {
  const who = await actor();
  if (!who) return { success: false, error: "Not authenticated." };

  const parsed = OrderSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: issueMessage(parsed.error, orderLabel(input)) };

  const season = await prisma.season.findFirst({ where: { teamId: who.teamId, isActive: true }, select: { id: true } });
  if (!season) return { success: false, error: "No active season. Set up a season first." };

  const res = await createOrder({ actor: who, seasonId: season.id, name: parsed.data.name, items: parsed.data.items, budgetCategory: parsed.data.budgetCategory });
  if (res.success) {
    if (parsed.data.draftId) await prisma.orderDraft.deleteMany({ where: { id: parsed.data.draftId, userId: who.id } });
    refresh([res.requestId]);
  }
  return res;
}

// ── Drafts ──────────────────────────────────────────────────────────────────

// Drafts hold the form as typed, so fields are loose strings; they're checked on submit
const DraftSchema = z.object({
  draftId: z.string().max(300).nullable().optional(),
  name:    z.string().max(120),
  budgetCategory: BudgetCategory.nullable().optional(),
  items:   z.array(z.object({
    link: z.string().max(2000), vendorName: z.string().max(120), name: z.string().max(200), partNumber: z.string().max(120),
    unitCost: z.string().max(20), quantity: z.string().max(20), subTeam: z.string().max(40), importance: z.string().max(20),
    reasoning: z.string().max(2000), notes: z.string().max(2000),
    budgetCategory: z.string().max(40).optional(),
  })).max(100),
});

/** Save an in-progress order (private to its author). Creates it the first time. */
export async function saveOrderDraftAction(input: unknown): Promise<Result<{ draftId: string }>> {
  const who = await actor();
  if (!who) return { success: false, error: "Not authenticated." };
  const parsed = DraftSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Couldn't save this draft." };

  const { draftId, items } = parsed.data;
  const budgetCategory = parsed.data.budgetCategory ?? null;
  const name = parsed.data.name.trim() || "Untitled order";
  if (draftId) {
    const updated = await prisma.orderDraft.updateMany({ where: { id: draftId, userId: who.id }, data: { name, items, budgetCategory } });
    if (updated.count === 1) { revalidatePath("/procurement"); return { success: true, draftId }; }
    // Deleted meanwhile (or someone else's id) — save as a new draft instead
  }
  const created = await prisma.orderDraft.create({ data: { teamId: who.teamId, userId: who.id, name, items, budgetCategory } });
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
  requestId: z.string().max(300).min(1),
  budgetCategory: OrderBudgetCategory,
  name:      z.string().trim().max(300).min(1, "Give the order a name.").max(120),
  // Arrived items aren't sent (they're locked), so an order may come back with none here
  items:     z.array(ItemSchema.extend({ id: z.string().optional() })).max(100),
});

/** Anyone who can approve or order this order (and Head Mentors) — checked in editOrder. */
export async function editOrderAction(input: unknown): Promise<Result> {
  const who = await actor();
  if (!who) return { success: false, error: "Not authenticated." };

  const parsed = EditOrderSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: issueMessage(parsed.error, orderLabel(input)) };

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
  if (!who.roles.some((r) => ORDER_ADMIN_ROLES.includes(r))) return { success: false, error: "Only the Buyer or captains can add tracking links." };
  if (!Ids.safeParse(itemIds).success) return { success: false, error: "Choose at least one item." };

  const res = await addTracking(who.teamId, who, itemIds, url, label);
  if (res.success) refresh(await requestIdsFor(itemIds));
  return res;
}

export async function setItemStatusAction(itemIds: string[], status: string): Promise<Result<{ count: number }>> {
  const who = await actor();
  if (!who) return { success: false, error: "Not authenticated." };
  if (!who.roles.some((r) => STATUS_OVERRIDE_ROLES.includes(r))) return { success: false, error: "Only the Buyer or captains can change an item's status." };
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
  if (!who.roles.some((r) => ORDER_ADMIN_ROLES.includes(r))) return { success: false, error: "Only the Buyer or captains can export orders." };

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

// ── Budget categories ──────────────────────────────────────────────────────

const OrderBudgetSchema = z.object({
  requestId:      z.string().min(1).max(64),
  budgetCategory: OrderBudgetCategory,
  /** Each item's own category, or null to use the order's */
  items: z.array(z.object({ id: z.string().min(1).max(64), budgetCategory: BudgetCategory.nullable() })).max(200),
});

/**
 * Change what an order (and each of its items) is charged to in the budget — at any stage,
 * so orders placed before categories existed can be fixed. Spend already in the budget is
 * re-split to match.
 */
export async function setOrderBudgetAction(input: unknown): Promise<Result> {
  const who = await actor();
  if (!who) return { success: false, error: "Not authenticated." };
  const parsed = OrderBudgetSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: issueMessage(parsed.error, orderLabel(input)) };
  const { requestId, budgetCategory, items } = parsed.data;

  const order = await prisma.purchaseRequest.findFirst({
    where:  { id: requestId, season: { teamId: who.teamId } },
    select: {
      id: true, status: true, currentStepKey: true, workflowDefinitionId: true, requestedById: true, budgetCategory: true,
      lineItems: { select: { id: true, budgetCategory: true } },
    },
  });
  if (!order) return { success: false, error: "Order not found." };
  const def = await definitionFor(order.workflowDefinitionId);
  if (!canSetOrderBudget(who.roles, who.id, order, canEditOrder(def, order, who.roles))) {
    return { success: false, error: "Only whoever placed the order, its approvers, the Buyer, the Treasurer, Team Leadership and Head Mentors can change its budget category." };
  }

  const own = new Set(order.lineItems.map((l) => l.id));
  if (items.some((i) => !own.has(i.id))) return { success: false, error: "An item no longer belongs to this order. Refresh and try again." };

  await prisma.$transaction(async (tx) => {
    await tx.purchaseRequest.update({ where: { id: order.id }, data: { budgetCategory } });
    for (const i of items) {
      // Only stored when it differs from the order's
      const value = i.budgetCategory && i.budgetCategory !== budgetCategory ? i.budgetCategory : null;
      await tx.purchaseLineItem.update({ where: { id: i.id }, data: { budgetCategory: value } });
    }
    await syncOrderSpend(tx, order.id);
    await tx.purchaseRequestEvent.create({
      data: { requestId: order.id, action: "effect", actorId: who.id, note: `${who.name} set the budget category to ${BUDGET_CATEGORY_LABELS[budgetCategory]}${items.some((i) => i.budgetCategory && i.budgetCategory !== budgetCategory) ? " (some items charged elsewhere)" : ""}.` },
    });
  });
  refresh([order.id]);
  return { success: true };
}
