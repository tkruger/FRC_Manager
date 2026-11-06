// Editing an order: its name and items. Server-only.
//
// Anyone who can approve or order it may edit (see canEditOrder). Items already ordered or arrived
// keep their price and quantity (that's what was paid) and can't be removed; everything else about
// them can still be fixed. (Setting an item back to To order unlocks it — that's in the history too.)
// Every change is written to the order's history, field by field, and everyone on the order is told.

import { prisma } from "@/lib/prisma";
import type { BudgetCategoryType, RequestPriority, SubTeam } from "@/generated/prisma";
import { BUDGET_CATEGORY_LABELS } from "@/lib/budget-categories";
import { syncOrderSpend } from "./spend";
import { definitionFor, canEditOrder, canResubmitOrder, resubmitWorkflow, type Actor } from "@/lib/workflow/engine";
import { highestImportance, itemRef, type Importance } from "./constants";
import { assignItemNumbers } from "./numbers";
import { syncOrders } from "./items";
import type { NewItem } from "./create";
import { notifyUsers } from "@/lib/notify/deliver";

export type EditedItem = NewItem & { id?: string };

const EDITABLE_FIELDS = ["name", "vendorName", "partNumber", "vendorProductUrl", "unitCost", "quantity", "subTeam", "importance", "reasoning", "notes", "budgetCategory"] as const;

export async function editOrder(input: {
  actor:     Actor;
  requestId: string;
  name:      string;
  items:     EditedItem[];
  /** The order's budget category */
  budgetCategory: BudgetCategoryType;
  /** A denied or canceled order: save the fixes, then start it through the workflow again */
  resubmit?: boolean;
}): Promise<{ success: true } | { success: false; error: string }> {
  const { actor, requestId } = input;

  const order = await prisma.purchaseRequest.findFirst({
    where:  { id: requestId, season: { teamId: actor.teamId } },
    select: {
      id: true, title: true, status: true, currentStepKey: true, workflowDefinitionId: true, budgetCategory: true, requestedById: true,
      lineItems: { select: { id: true, orderNumber: true, status: true, name: true, vendorName: true, partNumber: true,
        vendorProductUrl: true, unitCost: true, quantity: true, subTeam: true, importance: true, reasoning: true,
        notes: true, baseItemId: true, budgetCategory: true } },
    },
  });
  if (!order) return { success: false, error: "Order not found." };
  const isReceived = order.status === "RECEIVED";

  const def = await definitionFor(order.workflowDefinitionId);
  const resubmit = !!input.resubmit;
  if (resubmit) {
    if (!canResubmitOrder(def, order, actor)) {
      return { success: false, error: order.status === "DENIED" || order.status === "CANCELLED"
        ? "Only the person who placed this order, its approvers, the Buyer and Head Mentors can resubmit it."
        : "Only a denied or canceled order can be resubmitted." };
    }
  } else if (!canEditOrder(def, order, actor.roles)) {
    return { success: false, error: "Only people who can approve or order this can edit it — and only while it's open." };
  }

  const name  = input.name.trim();
  const items = input.items.filter((i) => i.name.trim() && i.quantity > 0);
  const existing = new Map(order.lineItems.map((l) => [l.id, l]));
  const isLocked = (l: { status: string }) => l.status === "ORDERED" || l.status === "ARRIVED";
  const lockWord = (l: { status: string }) => (l.status === "ARRIVED" ? "has arrived" : "is already ordered");

  if (items.some((i) => i.id && !existing.has(i.id))) return { success: false, error: "An item no longer belongs to this order. Refresh and try again." };
  // Ordered and arrived items: price and quantity are what was paid
  for (const i of items) {
    const before = i.id ? existing.get(i.id)! : null;
    if (!before || !isLocked(before)) continue;
    const cost = i.unitCost ?? null;
    if (cost !== (before.unitCost ?? null) || i.quantity !== before.quantity) {
      return { success: false, error: `${itemRef(before)} ${before.name} ${lockWord(before)}, so its price and quantity can't be changed. (A Buyer can set it back to To order first if it really needs changing.)` };
    }
  }
  if (items.length === 0) return { success: false, error: "An order needs at least one item. Cancel it instead." };

  const keptIds = new Set(items.map((i) => i.id).filter(Boolean));
  const removedLocked = order.lineItems.find((l) => isLocked(l) && !keptIds.has(l.id));
  if (removedLocked) return { success: false, error: `${itemRef(removedLocked)} ${removedLocked.name} ${lockWord(removedLocked)}, so it can't be removed.` };
  if (isReceived && items.some((i) => !i.id)) return { success: false, error: "This order is complete — start a new order for more items." };
  const removed = order.lineItems.filter((l) => !keptIds.has(l.id));
  // New items join where the order is: still waiting on approval, or already approved
  const newStatus = order.status === "SUBMITTED" || resubmit ? "QUEUED" : "TO_ORDER";

  const changes: string[] = [];
  if (name !== order.title) changes.push(`renamed it from "${order.title}" to "${name}"`);
  const budgetCategory = input.budgetCategory;
  if (budgetCategory !== order.budgetCategory) {
    changes.push(`budget category ${order.budgetCategory ? BUDGET_CATEGORY_LABELS[order.budgetCategory] : "none"} → ${BUDGET_CATEGORY_LABELS[budgetCategory]}`);
  }

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

    const changedItems: string[] = [];
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
        // Only stored when it differs from the order's
        budgetCategory:   (i.budgetCategory && i.budgetCategory !== budgetCategory ? i.budgetCategory : null) as BudgetCategoryType | null,
      };
      if (i.id) {
        const before = existing.get(i.id)!;
        const diffs = EDITABLE_FIELDS.filter((f) => (before[f] ?? null) !== (data[f] ?? null)).map((f) => describe(f, before[f], data[f]));
        if (diffs.length) {
          await tx.purchaseLineItem.update({ where: { id: i.id }, data });
          changedItems.push(`${itemRef(before)} ${before.name}: ${diffs.join(", ")}`);
        }
      } else {
        const created = await tx.purchaseLineItem.create({ data: { ...data, requestId: order.id, status: newStatus } });
        added.push(created.id);
      }
    }
    changes.push(...changedItems);

    if (added.length) {
      // Approved orders are final, so new items get their item IDs straight away
      const numbers = newStatus === "TO_ORDER" ? await assignItemNumbers(tx, actor.teamId, { itemIds: added }) : new Map<string, number>();
      const names = items.filter((i) => !i.id).map((i, idx) =>
        `${itemRef({ id: added[idx], orderNumber: numbers.get(added[idx]) ?? null })} ${i.name.trim()} (${i.quantity}${i.unitCost != null ? ` × ${money(i.unitCost)}` : ""})`);
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
        budgetCategory,
        estimatedTotal: total,
        priority:       highestImportance(all.map((l) => l.importance as Importance)) as RequestPriority,
        subTeam:        subTeams.length === 1 ? subTeams[0] : null,
        justification:  all.length === 1 ? all[0].reasoning ?? null : null,
      },
    });
    // Recorded spend follows the items' categories; money only committed (not yet spent)
    // also follows the new total
    const recorded = await tx.expense.findMany({ where: { purchaseRequestId: order.id }, select: { isCommitment: true } });
    const committedOnly = recorded.length > 0 && recorded.every((e) => e.isCommitment);
    await syncOrderSpend(tx, order.id, committedOnly ? { amount: total } : {});

    if (changes.length) {
      await tx.purchaseRequestEvent.create({
        data: { requestId: order.id, action: "effect", actorId: actor.id, note: `${actor.name} ${resubmit ? "fixed" : "edited"} the order: ${changes.join("; ")}.` },
      });
    }
  }, { timeout: 20_000 });

  if (changes.length) await tellParticipants(order.id, actor, name || order.title, changes, resubmit ? "fixed" : "edited");

  if (resubmit) {
    await resubmitWorkflow(order.id, actor);
    return { success: true };
  }
  // Removing the last item that wasn't ordered/arrived can complete a step
  await syncOrders([order.id], actor);
  return { success: true };
}

const FIELD_LABELS: Record<(typeof EDITABLE_FIELDS)[number], string> = {
  name: "name", vendorName: "vendor", partNumber: "part number", vendorProductUrl: "link", unitCost: "unit price",
  quantity: "quantity", subTeam: "sub-team", importance: "importance", reasoning: "reasoning", notes: "notes", budgetCategory: "budget category",
};
const money = (v: unknown) => `$${Number(v).toFixed(2)}`;

/** "quantity 4 → 6", "unit price $3.00 → $3.50", "notes changed" */
function describe(field: (typeof EDITABLE_FIELDS)[number], from: unknown, to: unknown): string {
  const label = FIELD_LABELS[field];
  if (field === "reasoning" || field === "notes" || field === "vendorProductUrl") {
    return from == null || from === "" ? `${label} added` : to == null || to === "" ? `${label} removed` : `${label} changed`;
  }
  const show = (v: unknown) => {
    if (v == null || v === "") return "none";
    if (field === "unitCost") return money(v);
    if (field === "budgetCategory") return BUDGET_CATEGORY_LABELS[v as BudgetCategoryType] ?? String(v);
    if (field === "importance" || field === "subTeam") return String(v).charAt(0) + String(v).slice(1).toLowerCase().replace(/_/g, " ");
    return field === "quantity" ? String(v) : `"${String(v)}"`;
  };
  return `${label} ${show(from)} → ${show(to)}`;
}

/** Everyone on the order — who placed it and everyone who has acted on it — hears what changed */
export async function tellParticipants(requestId: string, actor: Actor, title: string, changes: string[], verb = "edited") {
  try {
    const order = await prisma.purchaseRequest.findUnique({
      where:  { id: requestId },
      select: { requestedById: true, events: { select: { actorId: true } } },
    });
    if (!order) return;
    const ids = [...new Set([order.requestedById, ...order.events.map((e) => e.actorId)])].filter((id): id is string => !!id && id !== actor.id);
    if (ids.length === 0) return;
    // The push shows the first change; the app and the email list them all
    const first = changes[0].length > 200 ? changes[0].slice(0, 197) + "…" : changes[0];
    const body = changes.length > 1 ? `${first} — and ${changes.length - 1} more change${changes.length === 2 ? "" : "s"}` : first;
    await notifyUsers(ids, {
      topic: "purchase.changes",
      type:  "ORDER_CHANGED",
      title: `${actor.name} ${verb} "${title}"`,
      body,
      details: changes.map((c) => `• ${c}`).join("\n"),
      url:   `/procurement/requests/${requestId}`,
      tag:   `order-changed-${requestId}`,
    });
  } catch (e) {
    console.error("[orders] couldn't tell people about an edit:", e);
  }
}
