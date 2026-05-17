"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import type { PurchaseStatus } from "@/generated/prisma";
import { notifyTeam, createNotification } from "@/lib/notifications";

// Auto-approve threshold (USD)
const AUTO_APPROVE_THRESHOLD = 50;

const LineItemSchema = z.object({
  name: z.string().min(1),
  partNumber: z.string().optional(),
  vendorProductUrl: z.string().optional(),
  quantity: z.coerce.number().positive(),
  unitCost: z.coerce.number().min(0).optional(),
  goesOnRobotBom: z.coerce.boolean().optional(),
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
    });
    if (li.success) lineItems.push(li.data);
    i++;
  }
  if (lineItems.length === 0) return { success: false, error: "Add at least one line item." };

  const estimatedTotal = lineItems.reduce(
    (sum, li) => sum + (li.unitCost ?? 0) * li.quantity,
    0
  );

  const isEmergency = parsed.data.priority === "EMERGENCY";
  const autoApprove = !isEmergency && estimatedTotal <= AUTO_APPROVE_THRESHOLD;

  const request = await prisma.purchaseRequest.create({
    data: {
      seasonId: activeSeason.id,
      title: parsed.data.title,
      requestedById: session.user.id,
      subTeam: (parsed.data.subTeam as any) || null,
      priority: parsed.data.priority,
      justification: parsed.data.justification,
      preferredVendorId: parsed.data.preferredVendorId || null,
      budgetCategory: (parsed.data.budgetCategory as any) || null,
      estimatedTotal,
      status: autoApprove ? "APPROVED" : "SUBMITTED",
      lineItems: {
        create: lineItems.map((li) => ({
          name: li.name,
          partNumber: li.partNumber,
          vendorProductUrl: li.vendorProductUrl,
          quantity: li.quantity,
          unitCost: li.unitCost,
          lineTotal: li.unitCost != null ? li.unitCost * li.quantity : null,
          goesOnRobotBom: li.goesOnRobotBom ?? false,
        })),
      },
    },
  });

  // Notify budget managers of non-auto-approved requests
  if (!autoApprove && session.user.teamId) {
    await notifyTeam({
      teamId: session.user.teamId,
      roles: ["BUDGET_MANAGER", "HEAD_MENTOR"],
      type: isEmergency ? "PURCHASE_SUBMITTED" : "PURCHASE_SUBMITTED",
      title: isEmergency
        ? `🚨 Emergency purchase request: "${parsed.data.title}"`
        : `Purchase request needs approval: "${parsed.data.title}"`,
      body: `$${estimatedTotal.toFixed(2)} · submitted by ${session.user.name}`,
      linkUrl: `/procurement/requests/${request.id}`,
    });
  }

  revalidatePath("/procurement");
  return { success: true, requestId: request.id };
}

export async function approvePurchaseRequestAction(requestId: string): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session) return { success: false, error: "Not authenticated." };

  const req = await prisma.purchaseRequest.update({
    where: { id: requestId },
    data: { status: "APPROVED", approverId: session.user.id, approvalNotes: null },
    select: { title: true, requestedById: true },
  });

  // Notify requester
  await createNotification({
    userId: req.requestedById,
    type: "PURCHASE_APPROVED",
    title: `Purchase request approved: "${req.title}"`,
    linkUrl: `/procurement/requests/${requestId}`,
  });

  revalidatePath("/procurement");
  revalidatePath(`/procurement/requests/${requestId}`);
  return { success: true };
}

export async function denyPurchaseRequestAction(requestId: string, reason: string): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session) return { success: false, error: "Not authenticated." };

  const denied = await prisma.purchaseRequest.update({
    where: { id: requestId },
    data: { status: "DENIED", approverId: session.user.id, approvalNotes: reason },
    select: { title: true, requestedById: true },
  });

  await createNotification({
    userId: denied.requestedById,
    type: "PURCHASE_DENIED",
    title: `Purchase request denied: "${denied.title}"`,
    body: reason || undefined,
    linkUrl: `/procurement/requests/${requestId}`,
  });

  revalidatePath("/procurement");
  revalidatePath(`/procurement/requests/${requestId}`);
  return { success: true };
}

export async function markOrderedAction(requestId: string, formData: FormData): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session) return { success: false, error: "Not authenticated." };

  await prisma.purchaseRequest.update({
    where: { id: requestId },
    data: {
      status: "ORDERED",
      orderDate: new Date(),
      orderConfirmation: (formData.get("orderConfirmation") as string) || null,
      actualTotal: formData.get("actualTotal") ? parseFloat(formData.get("actualTotal") as string) : null,
      expectedDelivery: formData.get("expectedDelivery") ? new Date(formData.get("expectedDelivery") as string) : null,
    },
  });

  revalidatePath("/procurement");
  revalidatePath(`/procurement/requests/${requestId}`);
  return { success: true };
}

export async function markReceivedAction(requestId: string): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session) return { success: false, error: "Not authenticated." };

  await prisma.purchaseRequest.update({
    where: { id: requestId },
    data: { status: "RECEIVED", receivedDate: new Date() },
  });

  revalidatePath("/procurement");
  revalidatePath(`/procurement/requests/${requestId}`);
  return { success: true };
}
