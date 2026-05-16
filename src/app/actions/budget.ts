"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import type { BudgetCategoryType, FundingType } from "@/generated/prisma";

const DEFAULT_CATEGORIES: { type: BudgetCategoryType; label: string }[] = [
  { type: "REGISTRATION_FEES",  label: "Registration & Competition Fees" },
  { type: "ROBOT_MECHANICAL",   label: "Robot Parts — Mechanical" },
  { type: "ROBOT_ELECTRICAL",   label: "Robot Parts — Electrical" },
  { type: "ROBOT_PNEUMATICS",   label: "Robot Parts — Pneumatics" },
  { type: "RAW_MATERIALS",      label: "Raw Materials" },
  { type: "TOOLS_EQUIPMENT",    label: "Tools & Equipment" },
  { type: "CONSUMABLES",        label: "Consumables" },
  { type: "SAFETY_EQUIPMENT",   label: "Safety Equipment" },
  { type: "TRAVEL_HOTEL",       label: "Travel & Hotel" },
  { type: "FOOD_MEALS",         label: "Food & Meals" },
  { type: "AWARDS_OUTREACH",    label: "Awards & Outreach" },
  { type: "CONTINGENCY",        label: "Contingency Reserve" },
];

export async function setupBudgetAction(
  _prev: { success: boolean; error?: string } | null,
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.teamId) return { success: false, error: "Not authenticated." };

  const activeSeason = await prisma.season.findFirst({
    where: { teamId: session.user.teamId, isActive: true },
  });
  if (!activeSeason) return { success: false, error: "No active season." };

  const totalEstRevenue = parseFloat(formData.get("totalEstRevenue") as string) || 0;

  // Build category allocations from form
  const categoryAllocations = DEFAULT_CATEGORIES.map((c) => ({
    type: c.type,
    label: c.label,
    allocation: parseFloat(formData.get(`cat_${c.type}`) as string) || 0,
  }));

  // Upsert budget
  const existing = await prisma.budget.findUnique({ where: { seasonId: activeSeason.id } });

  if (existing) {
    await prisma.budget.update({
      where: { seasonId: activeSeason.id },
      data: { totalEstRevenue },
    });
    for (const cat of categoryAllocations) {
      await prisma.budgetCategory.upsert({
        where: { id: `${existing.id}_${cat.type}` },
        create: { budgetId: existing.id, type: cat.type, label: cat.label, allocation: cat.allocation },
        update: { allocation: cat.allocation },
      });
    }
  } else {
    await prisma.budget.create({
      data: {
        seasonId: activeSeason.id,
        totalEstRevenue,
        categories: { create: categoryAllocations },
      },
    });
  }

  revalidatePath("/budget");
  revalidatePath("/budget/setup");
  return { success: true };
}

const FundingSchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  amount: z.coerce.number().min(0),
  status: z.enum(["PLEDGED", "RECEIVED", "PARTIAL"]).default("PLEDGED"),
  notes: z.string().optional(),
});

export async function addFundingSourceAction(
  budgetId: string,
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session) return { success: false, error: "Not authenticated." };

  const parsed = FundingSchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
    amount: formData.get("amount"),
    status: formData.get("status"),
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) return { success: false, error: "Please fill in all fields." };

  await prisma.fundingSource.create({
    data: {
      budgetId,
      name: parsed.data.name,
      type: parsed.data.type as FundingType,
      amount: parsed.data.amount,
      status: parsed.data.status,
      notes: parsed.data.notes,
    },
  });

  revalidatePath("/budget");
  return { success: true };
}

const ExpenseSchema = z.object({
  date: z.string().min(1),
  amount: z.coerce.number().min(0),
  vendor: z.string().optional(),
  description: z.string().min(1),
  paymentMethod: z.string().optional(),
  categoryId: z.string().optional(),
});

export async function logExpenseAction(
  budgetId: string,
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session) return { success: false, error: "Not authenticated." };

  const parsed = ExpenseSchema.safeParse({
    date: formData.get("date"),
    amount: formData.get("amount"),
    vendor: formData.get("vendor") || undefined,
    description: formData.get("description"),
    paymentMethod: formData.get("paymentMethod") || undefined,
    categoryId: formData.get("categoryId") || undefined,
  });
  if (!parsed.success) return { success: false, error: "Please fill in all required fields." };

  await prisma.expense.create({
    data: {
      budgetId,
      date: new Date(parsed.data.date),
      amount: parsed.data.amount,
      vendor: parsed.data.vendor,
      description: parsed.data.description,
      paymentMethod: parsed.data.paymentMethod,
      categoryId: parsed.data.categoryId || null,
    },
  });

  revalidatePath("/budget");
  return { success: true };
}
