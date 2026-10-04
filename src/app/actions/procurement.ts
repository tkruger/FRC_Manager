"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import type { BudgetCategoryType, SubTeam } from "@/generated/prisma";
import { startWorkflow, performAction, describeRequestState, type WorkflowAction, type Actor, type ActionResult } from "@/lib/workflow/engine";

const LineItemSchema = z.object({
  name: z.string().min(1),
  partNumber: z.string().optional(),
  vendorProductUrl: z.string().optional(),
  quantity: z.coerce.number().positive(),
  unitCost: z.coerce.number().min(0).optional(),
  goesOnRobotBom: z.coerce.boolean().optional(),
  baseItemId: z.string().optional(),
});

const PurchaseRequestSchema = z.object({
  title: z.string().min(1),
  subTeam: z.string().optional(),
  priority: z.enum(["ROUTINE", "URGENT", "EMERGENCY"]).default("ROUTINE"),
  justification: z.string().optional(),
  preferredVendorId: z.string().optional(),
  budgetCategory: z.string().optional(),
});

export type PurchaseRequestState =
  | { success: true; requestId: string; stage: string }
  | { success: false; error: string };

type Session = { user: { id: string; name?: string | null; roles: Actor["roles"]; teamId?: string | null } };
type LineItem = z.infer<typeof LineItemSchema>;

/**
 * Shared by every way of raising a purchase request. Every line linked to an
 * inventory item gets an order-queue entry (reusing the item's open entry if it has
 * one), so items always show in the order queue until they're delivered.
 */
async function createPurchaseRequest(
  session: Session,
  seasonId: string,
  data: z.infer<typeof PurchaseRequestSchema>,
  lineItems: LineItem[],
): Promise<PurchaseRequestState> {
  const teamId = session.user.teamId!;

  // Only link line items to inventory items that belong to this team's active season
  const requestedItemIds = [...new Set(lineItems.map((li) => li.baseItemId).filter((id): id is string => !!id))];
  const validItemIds = new Set(
    requestedItemIds.length === 0 ? [] : (await prisma.baseInventoryItem.findMany({
      where:  { id: { in: requestedItemIds }, seasonId },
      select: { id: true },
    })).map((b) => b.id)
  );

  // Don't raise a second request for something that's already on its way
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
        error: `${onOrder.baseItem.name} is already on an open request ("${onOrder.purchaseRequest?.title}"). Find it in the order queue.`,
      };
    }
  }

  const vendor = data.preferredVendorId
    ? await prisma.vendor.findFirst({ where: { id: data.preferredVendorId, teamId }, select: { id: true } })
    : null;

  const estimatedTotal = lineItems.reduce((sum, li) => sum + (li.unitCost ?? 0) * li.quantity, 0);

  const request = await prisma.purchaseRequest.create({
    data: {
      seasonId,
      title: data.title,
      requestedById: session.user.id,
      subTeam: (data.subTeam as SubTeam) || null,
      priority: data.priority,
      justification: data.justification,
      preferredVendorId: vendor?.id ?? null,
      budgetCategory: (data.budgetCategory as BudgetCategoryType) || null,
      estimatedTotal,
      status: "SUBMITTED",
      lineItems: {
        create: lineItems.map((li) => ({
          name: li.name,
          partNumber: li.partNumber,
          vendorProductUrl: li.vendorProductUrl,
          quantity: li.quantity,
          unitCost: li.unitCost,
          lineTotal: li.unitCost != null ? li.unitCost * li.quantity : null,
          goesOnRobotBom: li.goesOnRobotBom ?? false,
          baseItemId: li.baseItemId && validItemIds.has(li.baseItemId) ? li.baseItemId : null,
        })),
      },
    },
  });

  // Put every linked item in the order queue, tied to this request
  for (const itemId of validItemIds) {
    const qty = lineItems.filter((li) => li.baseItemId === itemId).reduce((n, li) => n + li.quantity, 0);
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

  // Hands the request to the team's workflow: pins the version, skips steps that
  // don't apply (e.g. small purchases), notifies whoever is up next.
  await startWorkflow(request.id, actorFrom(session));

  revalidatePath("/procurement");
  revalidatePath("/inventory");
  return { success: true, requestId: request.id, stage: await describeRequestState(request.id) };
}

function parseLineItems(formData: FormData): LineItem[] {
  // Indexed fields: lineItem_0_name, lineItem_0_quantity, etc.
  const lineItems: LineItem[] = [];
  for (let i = 0; formData.get(`lineItem_${i}_name`); i++) {
    const li = LineItemSchema.safeParse({
      name: formData.get(`lineItem_${i}_name`),
      partNumber: formData.get(`lineItem_${i}_partNumber`) || undefined,
      vendorProductUrl: formData.get(`lineItem_${i}_vendorProductUrl`) || undefined,
      quantity: formData.get(`lineItem_${i}_quantity`),
      unitCost: formData.get(`lineItem_${i}_unitCost`) || undefined,
      goesOnRobotBom: formData.get(`lineItem_${i}_goesOnRobotBom`) === "on",
      baseItemId: formData.get(`lineItem_${i}_baseItemId`) || undefined,
    });
    if (li.success) lineItems.push(li.data);
  }
  return lineItems;
}

export async function createPurchaseRequestAction(
  _prev: PurchaseRequestState | null,
  formData: FormData
): Promise<PurchaseRequestState> {
  const session = await auth();
  if (!session?.user?.teamId) return { success: false, error: "Not authenticated." };

  const activeSeason = await prisma.season.findFirst({
    where: { teamId: session.user.teamId, isActive: true },
  });
  if (!activeSeason) return { success: false, error: "No active season. Set up a season first." };

  const parsed = PurchaseRequestSchema.safeParse({
    title: formData.get("title"),
    subTeam: formData.get("subTeam") || undefined,
    priority: formData.get("priority"),
    justification: formData.get("justification") || undefined,
    preferredVendorId: formData.get("preferredVendorId") || undefined,
    budgetCategory: formData.get("budgetCategory") || undefined,
  });
  if (!parsed.success) return { success: false, error: "Please fill in all required fields." };

  const lineItems = parseLineItems(formData);
  if (lineItems.length === 0) return { success: false, error: "Add at least one line item." };

  return createPurchaseRequest(session, activeSeason.id, parsed.data, lineItems);
}

const NewItemSchema = z.object({
  name:              z.string().trim().min(1, "Enter what you need ordered.").max(120),
  partNumber:        z.string().trim().max(80).optional(),
  category:          z.enum(["MECHANICAL", "ELECTRICAL", "PNEUMATICS", "HARDWARE", "FASTENERS", "RAW_STOCK", "CONSUMABLES", "SAFETY", "ELECTRONICS", "SENSORS"]).default("HARDWARE"),
  unitOfMeasure:     z.enum(["EACH", "PACK", "FOOT", "METER", "INCH", "SHEET", "POUND", "GALLON", "SPOOL", "ROLL"]).default("EACH"),
  quantity:          z.coerce.number().positive("Enter how many you need."),
  unitCost:          z.coerce.number().min(0).optional(),
  preferredSupplier: z.string().trim().max(120).optional(),
  vendorProductUrl:  z.string().trim().url("Enter a full product link (https://…), or leave it blank.").optional(),
  priority:          z.enum(["ROUTINE", "URGENT", "EMERGENCY"]).default("ROUTINE"),
  justification:     z.string().trim().max(2000).optional(),
});

/**
 * Order something the team doesn't track in inventory yet: creates an empty
 * inventory item (0 in stock), puts it in the order queue and raises the request.
 * Open to every member — anyone may need something ordered. If an item with the
 * same name already exists, that item is used instead of creating a duplicate.
 */
export async function orderNewItemAction(
  _prev: PurchaseRequestState | null,
  formData: FormData
): Promise<PurchaseRequestState> {
  const session = await auth();
  if (!session?.user?.teamId) return { success: false, error: "Not authenticated." };

  const activeSeason = await prisma.season.findFirst({ where: { teamId: session.user.teamId, isActive: true } });
  if (!activeSeason) return { success: false, error: "No active season. Set up a season first." };

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
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Please check the form." };
  const d = parsed.data;

  const item = await prisma.baseInventoryItem.findFirst({
    where:  { seasonId: activeSeason.id, archived: false, name: { equals: d.name, mode: "insensitive" } },
    select: { id: true, name: true },
  }) ?? await prisma.baseInventoryItem.create({
    data: {
      seasonId:          activeSeason.id,
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

  return createPurchaseRequest(
    session,
    activeSeason.id,
    { title: `Order: ${item.name}`, priority: d.priority, justification: d.justification },
    [{
      name:             item.name,
      partNumber:       d.partNumber,
      vendorProductUrl: d.vendorProductUrl,
      quantity:         d.quantity,
      unitCost:         d.unitCost,
      baseItemId:       item.id,
    }],
  );
}

// ── Workflow actions ───────────────────────────────────────────────────────
// Permission checks live in the engine: every action is validated against the
// step the request is on and the roles that step allows.

function actorFrom(session: { user: { id: string; name?: string | null; roles: Actor["roles"]; teamId?: string | null } }): Actor {
  return { id: session.user.id, name: session.user.name, roles: session.user.roles, teamId: session.user.teamId! };
}

async function run(requestId: string, stepKey: string, action: WorkflowAction, input: Parameters<typeof performAction>[4] = {}): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.teamId) return { success: false, error: "Not authenticated." };

  const result = await performAction(requestId, stepKey, action, actorFrom(session), input);

  revalidatePath("/procurement");
  revalidatePath(`/procurement/requests/${requestId}`);
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

export async function markOrderedAction(requestId: string, stepKey: string, formData: FormData): Promise<ActionResult> {
  const actualTotal = parseFloat(formData.get("actualTotal") as string);
  const expected    = formData.get("expectedDelivery") as string | null;
  return run(requestId, stepKey, "order", {
    orderConfirmation: (formData.get("orderConfirmation") as string) || undefined,
    actualTotal:       Number.isFinite(actualTotal) ? actualTotal : undefined,
    expectedDelivery:  expected ? new Date(expected) : undefined,
  });
}

export async function markReceivedAction(requestId: string, stepKey: string, note?: string): Promise<ActionResult> {
  return run(requestId, stepKey, "receive", { note: note?.trim() || undefined });
}
