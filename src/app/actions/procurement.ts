"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import type { SubTeam } from "@/generated/prisma";
import { performAction, type WorkflowAction, type Actor, type ActionResult } from "@/lib/workflow/engine";
import { createOrder, type NewItem } from "@/lib/orders/create";

// Form-based order entry points (inventory "Order" buttons). The full order form
// uses createOrderAction in ./orders; both go through lib/orders/create.

export type PurchaseRequestState =
  | { success: true; requestId: string; stage: string }
  | { success: false; error: string };

type Session = { user: { id: string; name?: string | null; roles: Actor["roles"]; teamId?: string | null } };

function actorFrom(session: Session): Actor {
  return { id: session.user.id, name: session.user.name, roles: session.user.roles, teamId: session.user.teamId! };
}

const Importance = z.enum(["ROUTINE", "URGENT", "EMERGENCY"]).default("ROUTINE");

const LineItemSchema = z.object({
  name:             z.string().trim().min(1),
  partNumber:       z.string().optional(),
  vendorProductUrl: z.string().optional(),
  vendorName:       z.string().optional(),
  quantity:         z.coerce.number().positive(),
  unitCost:         z.coerce.number().min(0).optional(),
  baseItemId:       z.string().optional(),
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

  const res = await createOrder({ actor: actorFrom(session), seasonId: season.id, name: title, items });
  if (res.success) { revalidatePath("/procurement", "layout"); revalidatePath("/inventory"); }
  return res;
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
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Please check the form." };
  const d = parsed.data;

  const item = await prisma.baseInventoryItem.findFirst({
    where:  { seasonId: season.id, archived: false, name: { equals: d.name, mode: "insensitive" } },
    select: { id: true, name: true },
  }) ?? await prisma.baseInventoryItem.create({
    data: {
      seasonId:          season.id,
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

  const res = await createOrder({
    actor: actorFrom(session),
    seasonId: season.id,
    name: `Order: ${item.name}`,
    items: [{
      name: item.name, partNumber: d.partNumber, link: d.vendorProductUrl, vendorName: d.preferredSupplier,
      quantity: d.quantity, unitCost: d.unitCost, baseItemId: item.id,
      importance: d.priority, reasoning: d.justification,
    }],
  });
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
