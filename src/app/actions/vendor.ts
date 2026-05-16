"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

const FRC_VENDORS = [
  { name: "AndyMark", website: "https://www.andymark.com", typicalLeadDays: 5, frcDiscount: "PDV accepted", preferred: true },
  { name: "REV Robotics", website: "https://www.revrobotics.com", typicalLeadDays: 5, frcDiscount: "PDV accepted", preferred: true },
  { name: "West Coast Products (WCP)", website: "https://wcproducts.com", typicalLeadDays: 7, frcDiscount: "PDV accepted", preferred: true },
  { name: "McMaster-Carr", website: "https://www.mcmaster.com", typicalLeadDays: 2, notes: "Fast shipping, great for hardware", preferred: false },
  { name: "Amazon", website: "https://www.amazon.com", typicalLeadDays: 2, notes: "Prime shipping, emergency orders", preferred: false },
  { name: "Digi-Key", website: "https://www.digikey.com", typicalLeadDays: 3, frcDiscount: "PDV accepted ($65 voucher)", preferred: false },
  { name: "Automation Direct", website: "https://www.automationdirect.com", typicalLeadDays: 5, frcDiscount: "PDV accepted", preferred: false },
  { name: "Bimba", website: "https://www.bimba.com", typicalLeadDays: 10, notes: "Pneumatics specialist", preferred: false },
  { name: "VEXpro", website: "https://www.vexrobotics.com/vexpro", typicalLeadDays: 5, preferred: false },
  { name: "Grayhill", website: "https://www.grayhill.com", typicalLeadDays: 10, notes: "Encoders and controls", preferred: false },
];

export async function seedFrcVendorsAction(): Promise<{ success: boolean; error?: string; count?: number }> {
  const session = await auth();
  if (!session?.user?.teamId) return { success: false, error: "Not authenticated." };

  const existing = await prisma.vendor.findMany({
    where: { teamId: session.user.teamId },
    select: { name: true },
  });
  const existingNames = new Set(existing.map((v) => v.name));

  const toCreate = FRC_VENDORS.filter((v) => !existingNames.has(v.name));
  if (toCreate.length === 0) return { success: true, count: 0 };

  await prisma.vendor.createMany({
    data: toCreate.map((v) => ({ ...v, teamId: session.user.teamId! })),
  });

  revalidatePath("/procurement/vendors");
  return { success: true, count: toCreate.length };
}

const VendorSchema = z.object({
  name: z.string().min(1),
  website: z.string().url().optional().or(z.literal("")),
  frcDiscount: z.string().optional(),
  typicalLeadDays: z.coerce.number().int().min(0).optional(),
  primaryContact: z.string().optional(),
  accountNumber: z.string().optional(),
  notes: z.string().optional(),
  preferred: z.coerce.boolean().optional(),
});

export async function createVendorAction(
  _prev: { success: boolean; error?: string } | null,
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.teamId) return { success: false, error: "Not authenticated." };

  const parsed = VendorSchema.safeParse({
    name: formData.get("name"),
    website: formData.get("website") || undefined,
    frcDiscount: formData.get("frcDiscount") || undefined,
    typicalLeadDays: formData.get("typicalLeadDays") || undefined,
    primaryContact: formData.get("primaryContact") || undefined,
    accountNumber: formData.get("accountNumber") || undefined,
    notes: formData.get("notes") || undefined,
    preferred: formData.get("preferred") === "on",
  });

  if (!parsed.success) return { success: false, error: "Please fill in all required fields." };

  await prisma.vendor.create({
    data: { ...parsed.data, teamId: session.user.teamId, website: parsed.data.website || null },
  });

  revalidatePath("/procurement/vendors");
  return { success: true };
}

export async function updateVendorAction(
  vendorId: string,
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.teamId) return { success: false, error: "Not authenticated." };

  const parsed = VendorSchema.safeParse({
    name: formData.get("name"),
    website: formData.get("website") || undefined,
    frcDiscount: formData.get("frcDiscount") || undefined,
    typicalLeadDays: formData.get("typicalLeadDays") || undefined,
    primaryContact: formData.get("primaryContact") || undefined,
    accountNumber: formData.get("accountNumber") || undefined,
    notes: formData.get("notes") || undefined,
    preferred: formData.get("preferred") === "on",
  });

  if (!parsed.success) return { success: false, error: "Invalid data." };

  await prisma.vendor.updateMany({
    where: { id: vendorId, teamId: session.user.teamId },
    data: { ...parsed.data, website: parsed.data.website || null },
  });

  revalidatePath("/procurement/vendors");
  return { success: true };
}
