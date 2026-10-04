"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import type { ToolType, ToolSpace, ToolCondition } from "@/generated/prisma";

// Every physical tool is its own record. "Two drills" = two Tool rows with the same
// name, each with its own asset tag, condition, checkouts and barcode.

const ToolSchema = z.object({
  name:                    z.string().trim().min(1),
  toolType:                z.string().default("OTHER"),
  manufacturer:            z.string().optional(),
  model:                   z.string().optional(),
  assetTag:                z.string().trim().max(40).optional(),
  homeLocation:            z.string().optional(),
  space:                   z.string().default("SHOP_ONLY"),
  condition:               z.string().default("GOOD"),
  requiresCertification:   z.coerce.boolean().optional(),
  certificationName:       z.string().optional(),
  maintenanceIntervalDays: z.coerce.number().int().optional(),
  replacementCost:         z.coerce.number().optional(),
  notes:                   z.string().optional(),
});

const TOOL_EDIT_ROLES = ["INVENTORY_ADMIN", "BUILD_LEAD", "TEAM_LEADERSHIP", "HEAD_MENTOR"];
const TOOL_CONDITIONS = ["EXCELLENT", "GOOD", "FAIR", "NEEDS_REPAIR", "OUT_OF_SERVICE", "OUT_FOR_MAINTENANCE"] as const;
/** Tools in these conditions can't be checked out */
const UNAVAILABLE_CONDITIONS = ["OUT_OF_SERVICE", "OUT_FOR_MAINTENANCE"];
const MAX_COPIES = 50;

function parseToolForm(formData: FormData) {
  return ToolSchema.safeParse({
    name:                    formData.get("name"),
    toolType:                formData.get("toolType") || "OTHER",
    manufacturer:            formData.get("manufacturer") || undefined,
    model:                   formData.get("model") || undefined,
    assetTag:                formData.get("assetTag") || undefined,
    homeLocation:            formData.get("homeLocation") || undefined,
    space:                   formData.get("space") || "SHOP_ONLY",
    condition:               formData.get("condition") || "GOOD",
    requiresCertification:   formData.get("requiresCertification") === "on",
    certificationName:       formData.get("certificationName") || undefined,
    maintenanceIntervalDays: formData.get("maintenanceIntervalDays") || undefined,
    replacementCost:         formData.get("replacementCost") || undefined,
    notes:                   formData.get("notes") || undefined,
  });
}

/** Next free auto tags for the team: TOOL-0001, TOOL-0002, … (skips any already in use). */
async function allocateToolTags(teamId: string, count: number): Promise<string[]> {
  const tags: string[] = [];
  while (tags.length < count) {
    const need = count - tags.length;
    const { nextToolNumber } = await prisma.team.update({
      where:  { id: teamId },
      data:   { nextToolNumber: { increment: need } },
      select: { nextToolNumber: true },
    });
    const candidates = Array.from({ length: need }, (_, i) => `TOOL-${String(nextToolNumber - need + i).padStart(4, "0")}`);
    const taken = new Set((await prisma.tool.findMany({
      where:  { teamId, assetTag: { in: candidates } },
      select: { assetTag: true },
    })).map((t) => t.assetTag));
    tags.push(...candidates.filter((c) => !taken.has(c)));
  }
  return tags;
}

async function tagInUse(teamId: string, tag: string, exceptToolId?: string) {
  return !!await prisma.tool.findFirst({
    where:  { teamId, assetTag: { equals: tag, mode: "insensitive" }, ...(exceptToolId ? { id: { not: exceptToolId } } : {}) },
    select: { id: true },
  });
}

export async function createToolAction(
  _prev: { success: boolean; error?: string; created?: number } | null,
  formData: FormData
): Promise<{ success: boolean; error?: string; created?: number }> {
  const session = await auth();
  if (!session?.user?.teamId) return { success: false, error: "Not authenticated." };
  const teamId = session.user.teamId;

  const parsed = parseToolForm(formData);
  if (!parsed.success) return { success: false, error: "Please fill in all required fields." };
  const d = parsed.data;

  const count = Math.min(MAX_COPIES, Math.max(1, parseInt(formData.get("count") as string, 10) || 1));

  // A typed tag is used as-is for one tool, or as a prefix (TAG-1, TAG-2…) for several;
  // a blank tag gets the next TOOL-#### numbers.
  let tags: string[];
  if (d.assetTag) {
    tags = count === 1 ? [d.assetTag] : Array.from({ length: count }, (_, i) => `${d.assetTag}-${i + 1}`);
    for (const tag of tags) {
      if (await tagInUse(teamId, tag)) return { success: false, error: `Asset tag "${tag}" is already used by another tool.` };
    }
  } else {
    tags = await allocateToolTags(teamId, count);
  }

  const imageUrl = (formData.get("imageUrl") as string) || null;
  await prisma.tool.createMany({
    data: tags.map((assetTag) => ({
      teamId,
      name:                    d.name,
      toolType:                d.toolType as ToolType,
      manufacturer:            d.manufacturer,
      model:                   d.model,
      assetTag,
      homeLocation:            d.homeLocation,
      space:                   d.space as ToolSpace,
      condition:               d.condition as ToolCondition,
      requiresCertification:   d.requiresCertification ?? false,
      certificationName:       d.certificationName,
      maintenanceIntervalDays: d.maintenanceIntervalDays,
      replacementCost:         d.replacementCost,
      notes:                   d.notes,
      image:                   imageUrl,
    })),
  });

  revalidatePath("/tools");
  return { success: true, created: tags.length };
}

export async function updateToolImageAction(
  toolId: string,
  imageUrl: string | null
): Promise<{ success: boolean }> {
  const session = await auth();
  if (!session?.user?.teamId) return { success: false };

  await prisma.tool.update({
    where: { id: toolId, teamId: session.user.teamId },
    data:  { image: imageUrl },
  });

  revalidatePath(`/tools/${toolId}`);
  revalidatePath("/tools");
  return { success: true };
}

export async function updateToolAction(
  toolId: string,
  _prev: { success: boolean; error?: string } | null,
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.teamId) return { success: false, error: "Not authenticated." };
  if (!session.user.roles.some((r) => TOOL_EDIT_ROLES.includes(r)))
    return { success: false, error: "Not authorized." };
  const teamId = session.user.teamId;

  const parsed = parseToolForm(formData);
  if (!parsed.success) return { success: false, error: "Please fill in all required fields." };
  const d = parsed.data;

  const existing = await prisma.tool.findFirst({ where: { id: toolId, teamId }, select: { assetTag: true } });
  if (!existing) return { success: false, error: "Tool not found." };

  // Every tool keeps a tag; clearing it assigns the next TOOL-#### number
  const assetTag = d.assetTag || existing.assetTag || (await allocateToolTags(teamId, 1))[0];
  if (assetTag !== existing.assetTag && await tagInUse(teamId, assetTag, toolId)) {
    return { success: false, error: `Asset tag "${assetTag}" is already used by another tool.` };
  }

  await prisma.tool.update({
    where: { id: toolId, teamId },
    data: {
      name:                    d.name,
      toolType:                d.toolType as ToolType,
      manufacturer:            d.manufacturer,
      model:                   d.model,
      assetTag,
      homeLocation:            d.homeLocation,
      space:                   d.space as ToolSpace,
      condition:               d.condition as ToolCondition,
      requiresCertification:   d.requiresCertification ?? false,
      certificationName:       d.certificationName,
      maintenanceIntervalDays: d.maintenanceIntervalDays,
      replacementCost:         d.replacementCost,
      notes:                   d.notes,
    },
  });

  revalidatePath("/tools");
  revalidatePath(`/tools/${toolId}`);
  return { success: true };
}

export async function checkoutToolAction(
  toolId: string,
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.teamId) return { success: false, error: "Not authenticated." };

  const tool = await prisma.tool.findFirst({ where: { id: toolId, teamId: session.user.teamId, retired: false } });
  if (!tool) return { success: false, error: "Tool not found." };
  if (UNAVAILABLE_CONDITIONS.includes(tool.condition)) {
    return { success: false, error: `This ${tool.name} is ${tool.condition.replace(/_/g, " ").toLowerCase()}.` };
  }

  const open = await prisma.toolCheckout.findFirst({
    where:  { toolId, returnedAt: null },
    select: { user: { select: { name: true } } },
  });
  if (open) return { success: false, error: `This ${tool.name} (${tool.assetTag}) is already checked out by ${open.user.name}.` };

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
  if (!session?.user?.teamId) return { success: false };
  if (!(TOOL_CONDITIONS as readonly string[]).includes(condition)) return { success: false };

  // Borrowers return their own checkouts; tool managers can return anyone's
  const checkout = await prisma.toolCheckout.findFirst({
    where:  { id: checkoutId, returnedAt: null, tool: { teamId: session.user.teamId } },
    select: { toolId: true, userId: true },
  });
  if (!checkout) return { success: false };
  const canManage = session.user.roles.some((r) => TOOL_EDIT_ROLES.includes(r));
  if (checkout.userId !== session.user.id && !canManage) return { success: false };

  // The returned condition becomes this tool's condition — better or worse.
  // (Other copies with the same name are separate tools and aren't affected.)
  await prisma.$transaction([
    prisma.toolCheckout.update({
      where: { id: checkoutId },
      data:  { returnedAt: new Date(), returnCondition: condition as ToolCondition },
    }),
    prisma.tool.update({
      where: { id: checkout.toolId },
      data:  { condition: condition as ToolCondition },
    }),
  ]);

  revalidatePath("/tools");
  revalidatePath(`/tools/${checkout.toolId}`);
  return { success: true };
}

export async function retireToolAction(toolId: string): Promise<{ success: boolean }> {
  const session = await auth();
  if (!session?.user?.teamId || !session.user.roles.some((r) => TOOL_EDIT_ROLES.includes(r))) return { success: false };
  const retired = await prisma.tool.updateMany({ where: { id: toolId, teamId: session.user.teamId }, data: { retired: true } });
  if (retired.count === 0) return { success: false };
  revalidatePath("/tools");
  return { success: true };
}
