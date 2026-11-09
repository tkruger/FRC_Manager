"use server";

import { nextStockTag } from "@/lib/inventory/stock-tags";
import { z } from "zod";
import { issueMessage } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import type { SubTeam } from "@/generated/prisma";
import { performAction, type WorkflowAction, type Actor, type ActionResult } from "@/lib/workflow/engine";
import { CATEGORY_VALUES, DEFAULT_CATEGORY } from "@/lib/inventory/categories";
import { createOrder, type NewItem } from "@/lib/orders/create";
import { editableDrafts } from "@/lib/orders/drafts";

// Form-based order entry points (inventory "Order" buttons). The full order form
// uses createOrderAction in ./orders; both go through lib/orders/create.

export type PurchaseRequestState =
  | { success: true; requestId: string; stage: string }
  /** Added to one of your order drafts instead (not submitted) */
  | { success: true; draft: { id: string; name: string; items: number } }
  | { success: false; error: string };

/**
 * Where an inventory "Order" dialog sends its item: "submit" (an order of its own, sent now),
 * "new-draft", or "draft:<id>" (one of your saved drafts — finished and submitted from Orders).
 */
function destination(formData: FormData): { kind: "submit" } | { kind: "draft"; id: string | null } {
  const d = String(formData.get("destination") ?? "submit");
  if (d === "new-draft") return { kind: "draft", id: null };
  if (d.startsWith("draft:")) return { kind: "draft", id: d.slice(6) };
  return { kind: "submit" };
}

/** Add items to one of your drafts (or a new one), in the order form's own shape */
async function addToDraft(session: Session, draftId: string | null, name: string, items: NewItem[]): Promise<PurchaseRequestState> {
  const lines = items.map((i) => ({
    link: i.link ?? "", vendorName: i.vendorName ?? "", name: i.name, partNumber: i.partNumber ?? "",
    unitCost: i.unitCost != null ? String(i.unitCost) : "", quantity: String(i.quantity), subTeam: i.subTeam ?? "",
    importance: i.importance ?? "ROUTINE", reasoning: i.reasoning ?? "", notes: "", budgetCategory: "",
  }));
  if (draftId) {
    const draft = await prisma.orderDraft.findFirst({ where: { id: draftId, teamId: session.user.teamId!, ...editableDrafts(session.user.id) }, select: { id: true, name: true, items: true } });
    if (!draft) return { success: false, error: "That draft is gone — pick another or start a new one." };
    const was = Array.isArray(draft.items) ? draft.items : [];
    // A draft starts with one empty row; replace it rather than keep a blank item
    const kept = was.filter((x) => typeof x === "object" && x && String((x as { name?: unknown }).name ?? "").trim());
    const next = [...kept, ...lines];
    if (next.length > 100) return { success: false, error: "That draft is full (100 items) — start a new one." };
    await prisma.orderDraft.update({ where: { id: draft.id }, data: { items: next, lastEditedById: session.user.id } });
    revalidatePath("/procurement");
    return { success: true, draft: { id: draft.id, name: draft.name, items: next.length } };
  }
  const created = await prisma.orderDraft.create({
    data: { teamId: session.user.teamId!, userId: session.user.id, name: name.slice(0, 120), items: lines, lastEditedById: session.user.id },
    select: { id: true, name: true },
  });
  revalidatePath("/procurement");
  return { success: true, draft: { ...created, items: lines.length } };
}

type Session = { user: { id: string; name?: string | null; roles: Actor["roles"]; teamId?: string | null } };

function actorFrom(session: Session): Actor {
  return { id: session.user.id, name: session.user.name, roles: session.user.roles, teamId: session.user.teamId! };
}

const Importance = z.enum(["ROUTINE", "URGENT", "EMERGENCY"]).default("ROUTINE");

const LineItemSchema = z.object({
  name:             z.string().trim().max(300).min(1),
  partNumber:       z.string().max(300).optional(),
  vendorProductUrl: z.string().max(2000).optional(),
  vendorName:       z.string().max(300).optional(),
  quantity:         z.coerce.number().positive(),
  unitCost:         z.coerce.number().min(0).optional(),
  baseItemId:       z.string().max(300).optional(),
});

/** Order an inventory item (Low stock / Order queue "Order" button). */
export async function createPurchaseRequestAction(
  _prev: PurchaseRequestState | null,
  formData: FormData
): Promise<PurchaseRequestState> {
  const session = await auth();
  if (!session?.user?.teamId) return { success: false, error: "Not authenticated." };

  const season = await prisma.season.findFirst({ where: { teamId: session.user.teamId, isActive: true }, select: { id: true } });
  if (!season) return { success: false, error: "No active season. Set up a season first." };

  const title = String(formData.get("title") ?? "").trim();
  const importance = Importance.safeParse(formData.get("priority") || undefined);
  const reasoning = (formData.get("justification") as string) || undefined;
  if (!title || !importance.success) return { success: false, error: "Please fill in all required fields." };

  const items: NewItem[] = [];
  for (let i = 0; formData.get(`lineItem_${i}_name`); i++) {
    const li = LineItemSchema.safeParse({
      name:             formData.get(`lineItem_${i}_name`),
      partNumber:       formData.get(`lineItem_${i}_partNumber`) || undefined,
      vendorProductUrl: formData.get(`lineItem_${i}_vendorProductUrl`) || undefined,
      vendorName:       formData.get(`lineItem_${i}_vendorName`) || undefined,
      quantity:         formData.get(`lineItem_${i}_quantity`),
      unitCost:         formData.get(`lineItem_${i}_unitCost`) || undefined,
      baseItemId:       formData.get(`lineItem_${i}_baseItemId`) || undefined,
    });
    if (!li.success) continue;
    items.push({
      name: li.data.name, partNumber: li.data.partNumber, link: li.data.vendorProductUrl,
      vendorName: li.data.vendorName, quantity: li.data.quantity, unitCost: li.data.unitCost,
      baseItemId: li.data.baseItemId, importance: importance.data, reasoning,
      subTeam: (formData.get("subTeam") as SubTeam) || null,
    });
  }
  if (items.length === 0) return { success: false, error: "Add at least one item." };

  const to = destination(formData);
  if (to.kind === "draft") return addToDraft(session, to.id, title, items);
  const res = await createOrder({ actor: actorFrom(session), seasonId: season.id, name: title, items });
  if (res.success) { revalidatePath("/procurement", "layout"); revalidatePath("/inventory"); }
  return res;
}

const NewItemSchema = z.object({
  name:              z.string().trim().max(300).min(1, "Enter what you need ordered.").max(120),
  partNumber:        z.string().trim().max(300).max(80).optional(),
  category:          z.enum(CATEGORY_VALUES).default(DEFAULT_CATEGORY),
  unitOfMeasure:     z.enum(["EACH", "PACK", "FOOT", "METER", "INCH", "SHEET", "POUND", "GALLON", "SPOOL", "ROLL"]).default("EACH"),
  quantity:          z.coerce.number().positive("Enter how many you need."),
  unitCost:          z.coerce.number().min(0).optional(),
  preferredSupplier: z.string().trim().max(300).max(120).optional(),
  vendorProductUrl:  z.string().trim().max(2000).url("Enter a full product link (https://…), or leave it blank.").optional(),
  priority:          Importance,
  justification:     z.string().trim().max(2000).optional(),
});

/**
 * Order something the team doesn't track in inventory yet: creates an empty
 * inventory item (0 in stock), puts it in the order queue and raises the order.
 * Open to every member. Reuses an existing item with the same name.
 */
export async function orderNewItemAction(
  _prev: PurchaseRequestState | null,
  formData: FormData
): Promise<PurchaseRequestState> {
  const session = await auth();
  if (!session?.user?.teamId) return { success: false, error: "Not authenticated." };

  const season = await prisma.season.findFirst({ where: { teamId: session.user.teamId, isActive: true }, select: { id: true } });
  if (!season) return { success: false, error: "No active season. Set up a season first." };

  const parsed = NewItemSchema.safeParse({
    name:              formData.get("name"),
    partNumber:        formData.get("partNumber") || undefined,
    category:          formData.get("category") || undefined,
    unitOfMeasure:     formData.get("unitOfMeasure") || undefined,
    quantity:          formData.get("quantity"),
    unitCost:          formData.get("unitCost") || undefined,
    preferredSupplier: formData.get("preferredSupplier") || undefined,
    vendorProductUrl:  formData.get("vendorProductUrl") || undefined,
    priority:          formData.get("priority") || undefined,
    justification:     formData.get("justification") || undefined,
  });
  if (!parsed.success) return { success: false, error: issueMessage(parsed.error) };
  const d = parsed.data;

  const item = await prisma.baseInventoryItem.findFirst({
    where:  { seasonId: season.id, archived: false, unitOfMeasure: { not: "PARTIAL" }, name: { equals: d.name, mode: "insensitive" } },
    select: { id: true, name: true },
  }) ?? await prisma.baseInventoryItem.create({
    data: {
      seasonId:          season.id,
      stockTag:          await nextStockTag(prisma, session.user.teamId),
      name:              d.name,
      partNumber:        d.partNumber,
      category:          d.category,
      unitOfMeasure:     d.unitOfMeasure,
      currentStock:      0,
      minStockThreshold: 0,
      reorderQuantity:   d.quantity,
      unitCost:          d.unitCost,
      preferredSupplier: d.preferredSupplier,
      notes:             `Added from the order queue by ${session.user.name ?? "a team member"}.`,
    },
    select: { id: true, name: true },
  });

  const line: NewItem = {
    name: item.name, partNumber: d.partNumber, link: d.vendorProductUrl, vendorName: d.preferredSupplier,
    quantity: d.quantity, unitCost: d.unitCost, baseItemId: item.id,
    importance: d.priority, reasoning: d.justification,
  };
  const to = destination(formData);
  if (to.kind === "draft") return addToDraft(session, to.id, `Order: ${item.name}`, [line]);
  const res = await createOrder({ actor: actorFrom(session), seasonId: season.id, name: `Order: ${item.name}`, items: [line] });
  if (res.success) { revalidatePath("/procurement", "layout"); revalidatePath("/inventory"); }
  return res;
}

// ── Workflow actions (approval steps) ──────────────────────────────────────
// Permission checks live in the engine. Ordering and arrival happen per item
// (see ./orders), which moves the order through its later steps automatically.

async function run(requestId: string, stepKey: string, action: WorkflowAction, input: Parameters<typeof performAction>[4] = {}): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.teamId) return { success: false, error: "Not authenticated." };

  const result = await performAction(requestId, stepKey, action, actorFrom(session), input);

  revalidatePath("/procurement", "layout");
  revalidatePath("/inventory");
  revalidatePath("/budget");
  return result;
}

export async function approvePurchaseRequestAction(requestId: string, stepKey: string, note?: string): Promise<ActionResult> {
  return run(requestId, stepKey, "approve", { note: note?.trim() || undefined });
}

export async function denyPurchaseRequestAction(requestId: string, stepKey: string, reason: string): Promise<ActionResult> {
  return run(requestId, stepKey, "deny", { note: reason.trim() || undefined });
}

export async function cancelPurchaseRequestAction(requestId: string, stepKey: string, reason: string): Promise<ActionResult> {
  return run(requestId, stepKey, "cancel", { note: reason.trim() || undefined });
}
