"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

const BomItemSchema = z.object({
  partName:   z.string().min(1),
  partNumber: z.string().optional(),
  subsystem:  z.string().optional(),
  quantity:   z.coerce.number().positive(),
  unitFmv:    z.coerce.number().min(0).optional(),
  source:     z.enum(["BASE_INVENTORY", "KOP", "FIRST_CHOICE", "DIRECT", "DONATED"]).default("DIRECT"),
  notes:      z.string().optional(),
});

export async function addBomItemAction(
  robotId: string,
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.teamId) return { success: false, error: "Not authenticated." };

  const parsed = BomItemSchema.safeParse({
    partName:   formData.get("partName"),
    partNumber: formData.get("partNumber") || undefined,
    subsystem:  formData.get("subsystem") || undefined,
    quantity:   formData.get("quantity"),
    unitFmv:    formData.get("unitFmv") || undefined,
    source:     formData.get("source"),
    notes:      formData.get("notes") || undefined,
  });

  if (!parsed.success) return { success: false, error: "Please fill in all required fields." };
  const d = parsed.data;

  const totalFmv = d.unitFmv != null ? d.unitFmv * d.quantity : null;

  await prisma.bomItem.create({
    data: {
      robotId,
      partName:   d.partName,
      partNumber: d.partNumber,
      subsystem:  (d.subsystem as any) || null,
      quantity:   d.quantity,
      unitFmv:    d.unitFmv,
      totalFmv,
      source:     d.source,
      notes:      d.notes,
    },
  });

  revalidatePath("/budget/bom");
  return { success: true };
}

export async function deleteBomItemAction(itemId: string): Promise<{ success: boolean }> {
  const session = await auth();
  if (!session) return { success: false };
  await prisma.bomItem.delete({ where: { id: itemId } });
  revalidatePath("/budget/bom");
  return { success: true };
}
