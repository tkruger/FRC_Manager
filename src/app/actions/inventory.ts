"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import type { ItemCategory, ItemType, UnitOfMeasure } from "@/generated/prisma";
import { maybeQueueReorder } from "@/lib/workflow/reorder";
import { nextStockTag } from "@/lib/inventory/stock-tags";

const BaseItemSchema = z.object({
  name:               z.string().max(300).min(1),
  partNumber:         z.string().max(300).optional(),
  category:           z.string().max(300).default("MECHANICAL"),
  itemType:           z.string().max(300).default("DISCRETE"),
  description:        z.string().max(5000).optional(),
  unitOfMeasure:      z.string().max(300).default("EACH"),
  currentStock:       z.coerce.number().min(0).default(0),
  minStockThreshold:  z.coerce.number().min(0).default(0),
  reorderQuantity:    z.coerce.number().min(0).default(1),
  preferredSupplier:  z.string().max(300).optional(),
  supplierLeadDays:   z.coerce.number().int().optional(),
  unitCost:           z.coerce.number().min(0).optional(),
  fairMarketValue:    z.coerce.number().min(0).optional(),
  storageLocation:    z.string().max(300).optional(),
  isKopItem:          z.coerce.boolean().optional(),
  isFirstChoiceItem:  z.coerce.boolean().optional(),
  notes:              z.string().max(5000).optional(),
  /** Partial pieces: how much is left */
  amountLeft:         z.string().trim().max(120).optional(),
});

export type InventoryActionState = { success: boolean; error?: string };

const INVENTORY_MANAGER_ROLES = ["INVENTORY_ADMIN", "HEAD_MENTOR"] as const;

function canManageInventory(roles: string[]): boolean {
  return roles.some((r) => (INVENTORY_MANAGER_ROLES as readonly string[]).includes(r));
}

export async function createBaseItemAction(
  _prev: InventoryActionState | null,
  formData: FormData
): Promise<InventoryActionState> {
  const session = await auth();
  if (!session?.user?.teamId) return { success: false, error: "Not authenticated." };
  if (!canManageInventory(session.user.roles)) return { success: false, error: "Not authorized." };

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
    amountLeft:         formData.get("amountLeft") || undefined,
  });
  if (!parsed.success) return { success: false, error: "Please fill in all required fields." };

  const d = parsed.data;
  await prisma.baseInventoryItem.create({
    data: {
      seasonId:          activeSeason.id,
      stockTag:          await nextStockTag(prisma, session.user.teamId),
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
      amountLeft:        d.unitOfMeasure === "PARTIAL" ? d.amountLeft ?? null : null,
    },
  });

  revalidatePath("/inventory");
  revalidatePath("/inventory/base");
  return { success: true };
}

export async function updateBaseItemAction(
  itemId: string,
  _prev: InventoryActionState | null,
  formData: FormData
): Promise<InventoryActionState> {
  const session = await auth();
  if (!session?.user?.teamId) return { success: false, error: "Not authenticated." };

  const canEdit = session.user.roles.some((r) => ["INVENTORY_ADMIN", "HEAD_MENTOR"].includes(r));
  if (!canEdit) return { success: false, error: "Not authorized." };

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
    amountLeft:         formData.get("amountLeft") || undefined,
  });
  if (!parsed.success) return { success: false, error: "Please fill in all required fields." };

  const owned = await prisma.baseInventoryItem.findFirst({ where: { id: itemId, season: { teamId: session.user.teamId } }, select: { id: true } });
  if (!owned) return { success: false, error: "Item not found." };

  const d = parsed.data;
  await prisma.baseInventoryItem.update({
    where: { id: itemId },
    data: {
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
      amountLeft:        d.unitOfMeasure === "PARTIAL" ? d.amountLeft ?? null : null,
    },
  });

  revalidatePath("/inventory");
  revalidatePath(`/inventory/${itemId}`);
  return { success: true };
}

const AcquireSchema = z.object({
  quantity:    z.coerce.number().positive(),
  robotId:     z.string().max(300).optional(),
  location:    z.string().max(300).optional(),
  subsystem:   z.string().max(300).optional(),
  notes:       z.string().max(5000).optional(),
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

  // Auto-trigger reorder if at/below threshold (per the team's purchase workflow)
  await maybeQueueReorder(item, Math.max(0, newStock), session.user.teamId);

  revalidatePath("/inventory");
  return { success: true };
}

export async function updateStockAction(
  baseItemId: string,
  delta: number
): Promise<InventoryActionState> {
  const session = await auth();
  if (!session?.user?.teamId) return { success: false };
  if (!canManageInventory(session.user.roles)) return { success: false, error: "Not authorized." };

  if (!Number.isFinite(delta)) return { success: false, error: "Invalid quantity." };
  const item = await prisma.baseInventoryItem.findFirst({ where: { id: baseItemId, season: { teamId: session.user.teamId } } });
  if (!item) return { success: false };

  const newStock = Math.max(0, item.currentStock + delta);
  await prisma.baseInventoryItem.update({
    where: { id: baseItemId },
    data: { currentStock: newStock },
  });
  if (delta < 0) await maybeQueueReorder(item, newStock, session.user.teamId);

  revalidatePath("/inventory");
  return { success: true };
}

export async function dismissReorderAction(reqId: string): Promise<void> {
  const session = await auth();
  if (!session?.user?.teamId || !canManageInventory(session.user.roles)) return;

  await prisma.reorderRequest.updateMany({
    where: { id: reqId, baseItem: { season: { teamId: session.user.teamId } } },
    data: { status: "DISMISSED", resolvedAt: new Date() },
  });
  revalidatePath("/inventory");
}

// ── Retire / restore ────────────────────────────────────────────────────────

/**
 * Retire an item: it leaves the inventory (lists, low stock, the order queue, new orders)
 * but its history stays and it can be restored. Inventory Admins and Head Mentors.
 */
export async function retireItemAction(itemId: string): Promise<InventoryActionState> {
  const session = await auth();
  if (!session?.user?.teamId) return { success: false, error: "Not authenticated." };
  if (!canManageInventory(session.user.roles)) return { success: false, error: "Only Inventory Admins and Head Mentors can retire items." };

  const res = await prisma.baseInventoryItem.updateMany({
    where: { id: itemId, season: { teamId: session.user.teamId }, archived: false },
    data:  { archived: true, retiredAt: new Date(), retiredById: session.user.id },
  });
  if (res.count === 0) return { success: false, error: "Item not found (or already retired)." };

  // Restock requests nobody has turned into an order yet no longer apply
  await prisma.reorderRequest.updateMany({
    where: { baseItemId: itemId, status: "PENDING", purchaseRequestId: null },
    data:  { status: "DISMISSED", resolvedAt: new Date() },
  });

  revalidatePath("/inventory", "layout");
  return { success: true };
}

export async function restoreItemAction(itemId: string): Promise<InventoryActionState> {
  const session = await auth();
  if (!session?.user?.teamId) return { success: false, error: "Not authenticated." };
  if (!canManageInventory(session.user.roles)) return { success: false, error: "Only Inventory Admins and Head Mentors can restore items." };

  const res = await prisma.baseInventoryItem.updateMany({
    where: { id: itemId, season: { teamId: session.user.teamId }, archived: true },
    data:  { archived: false, retiredAt: null, retiredById: null },
  });
  if (res.count === 0) return { success: false, error: "Item not found (or not retired)." };

  revalidatePath("/inventory", "layout");
  return { success: true };
}

/** A photo we stored ourselves (uploaded through /api/tools/upload) */
const isOurPhoto = (url: string) => /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\//i.test(url);

/** A photo of the material (uploaded through /api/tools/upload); null removes it */
export async function updateItemImageAction(itemId: string, url: string | null): Promise<InventoryActionState> {
  const session = await auth();
  if (!session?.user?.teamId) return { success: false, error: "Not authenticated." };
  if (!canManageInventory(session.user.roles)) return { success: false, error: "Only Inventory Admins and Head Mentors can change photos." };
  if (url && !isOurPhoto(url)) return { success: false, error: "That isn't an uploaded photo." };
  const owned = await prisma.baseInventoryItem.findFirst({ where: { id: itemId, season: { teamId: session.user.teamId } }, select: { id: true } });
  if (!owned) return { success: false, error: "Item not found." };
  await prisma.baseInventoryItem.update({ where: { id: itemId }, data: { image: url } });
  revalidatePath("/inventory");
  revalidatePath(`/inventory/${itemId}`);
  return { success: true };
}

const PartialSchema = z.object({
  amountLeft:      z.string().trim().min(1, "Say how much is left — e.g. about 18 in, or half a sheet.").max(120),
  storageLocation: z.string().trim().max(300).optional(),
  notes:           z.string().trim().max(5000).optional(),
  pieces:          z.coerce.number().int().min(1).max(50).default(1),
  /** The piece was cut from a full one: take one off the full stock */
  takeFromStock:   z.boolean().default(false),
  /** A photo of this piece (already uploaded) */
  image:           z.string().max(500).optional(),
});

/**
 * A part-used piece of an item (an offcut, a part-used spool): its own entry in the same group — same
 * name, category and part number — with how much is left, where it is and its own label.
 */
export async function addPartialPieceAction(fromItemId: string, input: unknown): Promise<InventoryActionState & { id?: string }> {
  const session = await auth();
  if (!session?.user?.teamId) return { success: false, error: "Not authenticated." };
  if (!canManageInventory(session.user.roles)) return { success: false, error: "Only Inventory Admins and Head Mentors can add stock." };
  const parsed = PartialSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Check the details." };
  const d = parsed.data;
  const from = await prisma.baseInventoryItem.findFirst({
    where:  { id: fromItemId, season: { teamId: session.user.teamId } },
    select: { id: true, seasonId: true, name: true, partNumber: true, category: true, itemType: true, unitCost: true, preferredSupplier: true, storageLocation: true, currentStock: true, unitOfMeasure: true, minStockThreshold: true, reorderQuantity: true },
  });
  if (!from) return { success: false, error: "Item not found." };
  if (d.takeFromStock && (from.unitOfMeasure === "PARTIAL" || from.currentStock < 1)) return { success: false, error: "There's no full stock to take it from." };
  if (d.image && !isOurPhoto(d.image)) return { success: false, error: "That isn't an uploaded photo." };

  const created = await prisma.$transaction(async (tx) => {
    const piece = await tx.baseInventoryItem.create({
      data: {
        seasonId: from.seasonId, stockTag: await nextStockTag(tx, session.user.teamId!),
        name: from.name, partNumber: from.partNumber, category: from.category, itemType: from.itemType,
        unitOfMeasure: "PARTIAL", currentStock: d.pieces, minStockThreshold: 0, reorderQuantity: 0,
        amountLeft: d.amountLeft, storageLocation: d.storageLocation || from.storageLocation, image: d.image || null,
        unitCost: from.unitCost, preferredSupplier: from.preferredSupplier, notes: d.notes || null,
      },
      select: { id: true },
    });
    if (d.takeFromStock) await tx.baseInventoryItem.update({ where: { id: from.id }, data: { currentStock: { decrement: 1 } } });
    return piece;
  });
  // Cut from the full stock: that may bring it to its minimum
  if (d.takeFromStock) await maybeQueueReorder(from, from.currentStock - 1, session.user.teamId).catch(() => {});

  revalidatePath("/inventory");
  revalidatePath(`/inventory/${fromItemId}`);
  return { success: true, id: created.id };
}
