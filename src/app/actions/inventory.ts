"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import type { ItemCategory, ItemType, UnitOfMeasure } from "@/generated/prisma";

const BaseItemSchema = z.object({
  name:               z.string().min(1),
  partNumber:         z.string().optional(),
  category:           z.string().default("MECHANICAL"),
  itemType:           z.string().default("DISCRETE"),
  description:        z.string().optional(),
  unitOfMeasure:      z.string().default("EACH"),
  currentStock:       z.coerce.number().min(0).default(0),
  minStockThreshold:  z.coerce.number().min(0).default(0),
  reorderQuantity:    z.coerce.number().min(0).default(1),
  preferredSupplier:  z.string().optional(),
  supplierLeadDays:   z.coerce.number().int().optional(),
  unitCost:           z.coerce.number().min(0).optional(),
  fairMarketValue:    z.coerce.number().min(0).optional(),
  storageLocation:    z.string().optional(),
  isKopItem:          z.coerce.boolean().optional(),
  isFirstChoiceItem:  z.coerce.boolean().optional(),
  notes:              z.string().optional(),
});

export type InventoryActionState = { success: boolean; error?: string };

export async function createBaseItemAction(
  _prev: InventoryActionState | null,
  formData: FormData
): Promise<InventoryActionState> {
  const session = await auth();
  if (!session?.user?.teamId) return { success: false, error: "Not authenticated." };

  const activeSeason = await prisma.season.findFirst({
    where: { teamId: session.user.teamId, isActive: true },
  });
  if (!activeSeason) return { success: false, error: "No active season." };

  const parsed = BaseItemSchema.safeParse({
    name:               formData.get("name"),
    partNumber:         formData.get("partNumber") || undefined,
    category:           formData.get("category") || "MECHANICAL",
    itemType:           formData.get("itemType") || "DISCRETE",
    description:        formData.get("description") || undefined,
    unitOfMeasure:      formData.get("unitOfMeasure") || "EACH",
    currentStock:       formData.get("currentStock") || 0,
    minStockThreshold:  formData.get("minStockThreshold") || 0,
    reorderQuantity:    formData.get("reorderQuantity") || 1,
    preferredSupplier:  formData.get("preferredSupplier") || undefined,
    supplierLeadDays:   formData.get("supplierLeadDays") || undefined,
    unitCost:           formData.get("unitCost") || undefined,
    fairMarketValue:    formData.get("fairMarketValue") || undefined,
    storageLocation:    formData.get("storageLocation") || undefined,
    isKopItem:          formData.get("isKopItem") === "on",
    isFirstChoiceItem:  formData.get("isFirstChoiceItem") === "on",
    notes:              formData.get("notes") || undefined,
  });
  if (!parsed.success) return { success: false, error: "Please fill in all required fields." };

  const d = parsed.data;
  await prisma.baseInventoryItem.create({
    data: {
      seasonId:          activeSeason.id,
      name:              d.name,
      partNumber:        d.partNumber,
      category:          d.category as ItemCategory,
      itemType:          d.itemType as ItemType,
      description:       d.description,
      unitOfMeasure:     d.unitOfMeasure as UnitOfMeasure,
      currentStock:      d.currentStock,
      minStockThreshold: d.minStockThreshold,
      reorderQuantity:   d.reorderQuantity,
      preferredSupplier: d.preferredSupplier,
      supplierLeadDays:  d.supplierLeadDays,
      unitCost:          d.unitCost,
      fairMarketValue:   d.fairMarketValue,
      storageLocation:   d.storageLocation,
      isKopItem:         d.isKopItem ?? false,
      isFirstChoiceItem: d.isFirstChoiceItem ?? false,
      notes:             d.notes,
    },
  });

  revalidatePath("/inventory");
  revalidatePath("/inventory/base");
  return { success: true };
}

const AcquireSchema = z.object({
  quantity:    z.coerce.number().positive(),
  robotId:     z.string().optional(),
  location:    z.string().optional(),
  subsystem:   z.string().optional(),
  notes:       z.string().optional(),
});

export async function acquireItemAction(
  baseItemId: string,
  formData: FormData
): Promise<InventoryActionState> {
  const session = await auth();
  if (!session?.user?.teamId) return { success: false, error: "Not authenticated." };

  const item = await prisma.baseInventoryItem.findFirst({
    where: { id: baseItemId, season: { teamId: session.user.teamId } },
  });
  if (!item) return { success: false, error: "Item not found." };

  const parsed = AcquireSchema.safeParse({
    quantity:  formData.get("quantity"),
    robotId:   formData.get("robotId") || undefined,
    location:  formData.get("location") || undefined,
    subsystem: formData.get("subsystem") || undefined,
    notes:     formData.get("notes") || undefined,
  });
  if (!parsed.success) return { success: false, error: "Invalid quantity." };

  const d = parsed.data;

  // Decrement base stock
  const newStock = item.currentStock - d.quantity;
  await prisma.baseInventoryItem.update({
    where: { id: baseItemId },
    data: { currentStock: Math.max(0, newStock) },
  });

  // Create in-use item
  await prisma.inUseInventoryItem.create({
    data: {
      baseItemId,
      robotId:         d.robotId || null,
      name:            item.name,
      source:          "BASE_INVENTORY",
      category:        item.category,
      quantity:        d.quantity,
      unitOfMeasure:   item.unitOfMeasure,
      currentLocation: d.location,
      subsystem:       (d.subsystem as any) || null,
      notes:           d.notes,
    },
  });

  // Auto-trigger reorder if at/below threshold
  if (newStock <= item.minStockThreshold && item.minStockThreshold > 0) {
    await prisma.reorderRequest.create({
      data: { baseItemId, requestedQty: item.reorderQuantity },
    });
  }

  revalidatePath("/inventory");
  return { success: true };
}

export async function updateStockAction(
  baseItemId: string,
  delta: number
): Promise<InventoryActionState> {
  const session = await auth();
  if (!session) return { success: false };

  const item = await prisma.baseInventoryItem.findUnique({ where: { id: baseItemId } });
  if (!item) return { success: false };

  await prisma.baseInventoryItem.update({
    where: { id: baseItemId },
    data: { currentStock: Math.max(0, item.currentStock + delta) },
  });

  revalidatePath("/inventory");
  return { success: true };
}

export async function dismissReorderAction(reqId: string): Promise<void> {
  await prisma.reorderRequest.update({
    where: { id: reqId },
    data: { status: "DISMISSED", resolvedAt: new Date() },
  });
  revalidatePath("/inventory");
}
