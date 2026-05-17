"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import type { ToolType, ToolSpace, ToolCondition } from "@/generated/prisma";

const ToolSchema = z.object({
  name:                    z.string().min(1),
  toolType:                z.string().default("OTHER"),
  manufacturer:            z.string().optional(),
  model:                   z.string().optional(),
  assetTag:                z.string().optional(),
  quantityOwned:           z.coerce.number().int().min(1).default(1),
  homeLocation:            z.string().optional(),
  space:                   z.string().default("SHOP_ONLY"),
  condition:               z.string().default("GOOD"),
  requiresCertification:   z.coerce.boolean().optional(),
  certificationName:       z.string().optional(),
  maintenanceIntervalDays: z.coerce.number().int().optional(),
  replacementCost:         z.coerce.number().optional(),
  notes:                   z.string().optional(),
});

export async function createToolAction(
  _prev: { success: boolean; error?: string } | null,
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.teamId) return { success: false, error: "Not authenticated." };

  const parsed = ToolSchema.safeParse({
    name:                    formData.get("name"),
    toolType:                formData.get("toolType") || "OTHER",
    manufacturer:            formData.get("manufacturer") || undefined,
    model:                   formData.get("model") || undefined,
    assetTag:                formData.get("assetTag") || undefined,
    quantityOwned:           formData.get("quantityOwned") || 1,
    homeLocation:            formData.get("homeLocation") || undefined,
    space:                   formData.get("space") || "SHOP_ONLY",
    condition:               formData.get("condition") || "GOOD",
    requiresCertification:   formData.get("requiresCertification") === "on",
    certificationName:       formData.get("certificationName") || undefined,
    maintenanceIntervalDays: formData.get("maintenanceIntervalDays") || undefined,
    replacementCost:         formData.get("replacementCost") || undefined,
    notes:                   formData.get("notes") || undefined,
  });
  if (!parsed.success) return { success: false, error: "Please fill in all required fields." };

  await prisma.tool.create({
    data: {
      teamId:                  session.user.teamId,
      name:                    parsed.data.name,
      toolType:                parsed.data.toolType as ToolType,
      manufacturer:            parsed.data.manufacturer,
      model:                   parsed.data.model,
      assetTag:                parsed.data.assetTag,
      quantityOwned:           parsed.data.quantityOwned,
      homeLocation:            parsed.data.homeLocation,
      space:                   parsed.data.space as ToolSpace,
      condition:               parsed.data.condition as ToolCondition,
      requiresCertification:   parsed.data.requiresCertification ?? false,
      certificationName:       parsed.data.certificationName,
      maintenanceIntervalDays: parsed.data.maintenanceIntervalDays,
      replacementCost:         parsed.data.replacementCost,
      notes:                   parsed.data.notes,
    },
  });

  revalidatePath("/tools");
  return { success: true };
}

export async function checkoutToolAction(
  toolId: string,
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session) return { success: false, error: "Not authenticated." };

  const tool = await prisma.tool.findUnique({ where: { id: toolId } });
  if (!tool) return { success: false, error: "Tool not found." };

  // Check availability
  const activeCheckouts = await prisma.toolCheckout.count({
    where: { toolId, returnedAt: null },
  });
  const qty = parseInt(formData.get("quantity") as string) || 1;
  if (activeCheckouts + qty > tool.quantityOwned) {
    return { success: false, error: `Only ${tool.quantityOwned - activeCheckouts} unit(s) available.` };
  }

  // Certification check
  if (tool.requiresCertification && tool.certificationName) {
    const cert = await prisma.userCertification.findFirst({
      where: { userId: session.user.id, certName: tool.certificationName, status: "ACTIVE" },
    });
    if (!cert) return { success: false, error: `You need "${tool.certificationName}" certification to check out this tool.` };
  }

  const expectedReturn = formData.get("expectedReturn") as string;
  await prisma.toolCheckout.create({
    data: {
      toolId,
      userId:         session.user.id,
      quantity:       qty,
      intendedUse:    formData.get("intendedUse") as string || null,
      expectedReturn: expectedReturn ? new Date(expectedReturn) : new Date(Date.now() + 7 * 86400000),
    },
  });

  revalidatePath("/tools");
  revalidatePath(`/tools/${toolId}`);
  return { success: true };
}

export async function checkinToolAction(
  checkoutId: string,
  condition: string
): Promise<{ success: boolean }> {
  const session = await auth();
  if (!session) return { success: false };

  await prisma.toolCheckout.update({
    where: { id: checkoutId },
    data: { returnedAt: new Date(), returnCondition: condition as ToolCondition },
  });

  // Update tool condition if worsened
  const checkout = await prisma.toolCheckout.findUnique({ where: { id: checkoutId }, select: { toolId: true } });
  if (checkout && ["NEEDS_REPAIR", "OUT_OF_SERVICE"].includes(condition)) {
    await prisma.tool.update({
      where: { id: checkout.toolId },
      data: { condition: condition as ToolCondition },
    });
  }

  revalidatePath("/tools");
  return { success: true };
}

export async function retireToolAction(toolId: string): Promise<{ success: boolean }> {
  const session = await auth();
  if (!session) return { success: false };
  await prisma.tool.update({ where: { id: toolId }, data: { retired: true } });
  revalidatePath("/tools");
  return { success: true };
}
