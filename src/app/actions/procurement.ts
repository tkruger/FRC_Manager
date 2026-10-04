"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { startWorkflow, performAction, type WorkflowAction, type Actor, type ActionResult } from "@/lib/workflow/engine";

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
  reorderRequestId: z.string().optional(),
});

export type PurchaseRequestState =
  | { success: true; requestId: string }
  | { success: false; error: string };

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
    reorderRequestId: formData.get("reorderRequestId") || undefined,
  });
  if (!parsed.success) return { success: false, error: "Please fill in all required fields." };

  // Parse line items (indexed: lineItem_0_name, lineItem_0_quantity, etc.)
  const lineItems: z.infer<typeof LineItemSchema>[] = [];
  let i = 0;
  while (formData.get(`lineItem_${i}_name`)) {
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
    i++;
  }
  if (lineItems.length === 0) return { success: false, error: "Add at least one line item." };

  // Only link line items to inventory items that belong to this team's active season
  const requestedItemIds = lineItems.map((li) => li.baseItemId).filter((id): id is string => !!id);
  const validItemIds = new Set(
    requestedItemIds.length === 0 ? [] : (await prisma.baseInventoryItem.findMany({
      where: { id: { in: requestedItemIds }, seasonId: activeSeason.id },
      select: { id: true },
    })).map((b) => b.id)
  );

  const vendor = parsed.data.preferredVendorId
    ? await prisma.vendor.findFirst({ where: { id: parsed.data.preferredVendorId, teamId: session.user.teamId }, select: { id: true } })
    : null;

  const reorder = parsed.data.reorderRequestId
    ? await prisma.reorderRequest.findFirst({
        where: {
          id: parsed.data.reorderRequestId,
          baseItem: { seasonId: activeSeason.id },
          status: "PENDING",
          purchaseRequestId: null,
        },
      })
    : null;

  const estimatedTotal = lineItems.reduce(
    (sum, li) => sum + (li.unitCost ?? 0) * li.quantity,
    0
  );

  const request = await prisma.purchaseRequest.create({
    data: {
      seasonId: activeSeason.id,
      title: parsed.data.title,
      requestedById: session.user.id,
      subTeam: (parsed.data.subTeam as any) || null,
      priority: parsed.data.priority,
      justification: parsed.data.justification,
      preferredVendorId: vendor?.id ?? null,
      budgetCategory: (parsed.data.budgetCategory as any) || null,
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

  if (reorder) {
    await prisma.reorderRequest.update({
      where: { id: reorder.id },
      data: { purchaseRequestId: request.id },
    });
  }

  // Hands the request to the team's workflow: pins the version, skips steps that
  // don't apply (e.g. small purchases), notifies whoever is up next.
  await startWorkflow(request.id, actorFrom(session));

  revalidatePath("/procurement");
  revalidatePath("/inventory");
  return { success: true, requestId: request.id };
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
