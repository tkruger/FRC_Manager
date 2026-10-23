"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import type { BudgetCategoryType, FundingType } from "@/generated/prisma";
import { ActionError, userMessage } from "@/lib/action-error";
import { issueMessage } from "@/lib/validation";

const BUDGET_ROLES = ["HEAD_MENTOR", "TREASURER"] as const;

async function requireBudgetRole() {
  const session = await auth();
  if (!session?.user?.teamId) throw new ActionError("Not authenticated.");
  if (!session.user.roles.some((r) => BUDGET_ROLES.includes(r as any)))
    throw new ActionError("Only Head Mentors and Treasurers can modify the budget.");
  return session;
}

async function isTeamBudget(budgetId: string, teamId: string) {
  return !!await prisma.budget.findFirst({ where: { id: budgetId, season: { teamId } }, select: { id: true } });
}

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
  let session;
  try { session = await requireBudgetRole(); } catch (e) { return { success: false, error: userMessage(e) }; }

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
    // Fetch existing categories to decide update vs create
    const existingCats = await prisma.budgetCategory.findMany({
      where: { budgetId: existing.id },
      select: { id: true, type: true },
    });
    const catById = Object.fromEntries(existingCats.map((c) => [c.type, c.id]));

    for (const cat of categoryAllocations) {
      if (catById[cat.type]) {
        await prisma.budgetCategory.update({
          where: { id: catById[cat.type] },
          data: { allocation: cat.allocation, label: cat.label },
        });
      } else {
        await prisma.budgetCategory.create({
          data: { budgetId: existing.id, type: cat.type, label: cat.label, allocation: cat.allocation },
        });
      }
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

const FUNDING_TYPES = ["TEAM_ACCOUNT", "SCHOOL_ALLOCATION", "CORPORATE_SPONSOR", "GRANT", "FUNDRAISER", "INDIVIDUAL_DONATION", "PDV", "OTHER"] as const;

const FundingSchema = z.object({
  name:           z.string().trim().min(1, "Give the funding source a name.").max(300),
  type:           z.enum(FUNDING_TYPES, { error: "Choose a type." }),
  amount:         z.coerce.number().min(0).max(100_000_000),
  status:         z.enum(["PLEDGED", "RECEIVED", "PARTIAL"]).default("PLEDGED"),
  /** PARTIAL: how much has come in so far */
  receivedAmount: z.coerce.number().min(0).max(100_000_000).optional(),
  /** When the money came in (received / partial) — places it on the budget chart */
  receivedDate:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes:          z.string().max(5000).optional(),
});

/** Reads the funding form. Received money gets a date (today if none is given). */
function fundingData(formData: FormData) {
  const parsed = FundingSchema.safeParse({
    name:           formData.get("name"),
    type:           formData.get("type"),
    amount:         formData.get("amount"),
    status:         formData.get("status") || undefined,
    receivedAmount: formData.get("receivedAmount") || undefined,
    receivedDate:   formData.get("receivedDate") || undefined,
    notes:          formData.get("notes") || undefined,
  });
  if (!parsed.success) return { error: issueMessage(parsed.error) } as const;
  const d = parsed.data;
  if (d.status === "PARTIAL" && d.receivedAmount != null && d.receivedAmount > d.amount) {
    return { error: "The amount received can't be more than the total." } as const;
  }
  const received = d.status !== "PLEDGED";
  return {
    data: {
      name:           d.name,
      type:           d.type as FundingType,
      amount:         d.amount,
      status:         d.status,
      receivedAmount: d.status === "PARTIAL" ? d.receivedAmount ?? 0 : d.status === "RECEIVED" ? d.amount : null,
      receivedDate:   received ? (d.receivedDate ? new Date(`${d.receivedDate}T00:00:00.000Z`) : new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`)) : null,
      notes:          d.notes ?? null,
    },
  } as const;
}

export async function addFundingSourceAction(
  budgetId: string,
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  let session;
  try { session = await requireBudgetRole(); } catch (e) { return { success: false, error: userMessage(e) }; }
  if (!await isTeamBudget(budgetId, session.user.teamId!)) return { success: false, error: "Budget not found." };

  const res = fundingData(formData);
  if ("error" in res) return { success: false, error: res.error };
  await prisma.fundingSource.create({ data: { budgetId, ...res.data } });

  revalidatePath("/budget");
  revalidatePath("/dashboard");
  return { success: true };
}

/** The funding source if it's in one of the caller's team's budgets */
async function findTeamFunding(id: string, teamId: string) {
  return prisma.fundingSource.findFirst({ where: { id, budget: { season: { teamId } } }, select: { id: true } });
}

/** Edit a funding source — e.g. mark a pledge received */
export async function updateFundingSourceAction(id: string, formData: FormData): Promise<{ success: boolean; error?: string }> {
  let session;
  try { session = await requireBudgetRole(); } catch (e) { return { success: false, error: userMessage(e) }; }
  if (!await findTeamFunding(id, session.user.teamId!)) return { success: false, error: "Funding source not found." };

  const res = fundingData(formData);
  if ("error" in res) return { success: false, error: res.error };
  await prisma.fundingSource.update({ where: { id }, data: res.data });

  revalidatePath("/budget");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function deleteFundingSourceAction(id: string): Promise<{ success: boolean; error?: string }> {
  let session;
  try { session = await requireBudgetRole(); } catch (e) { return { success: false, error: userMessage(e) }; }
  if (!await findTeamFunding(id, session.user.teamId!)) return { success: false, error: "Funding source not found." };
  await prisma.fundingSource.delete({ where: { id } });
  revalidatePath("/budget");
  revalidatePath("/dashboard");
  return { success: true };
}

const ExpenseSchema = z.object({
  date: z.string().max(300).min(1),
  amount: z.coerce.number().min(0),
  vendor: z.string().max(300).optional(),
  description: z.string().max(5000).min(1),
  paymentMethod: z.string().max(300).optional(),
  categoryId: z.string().max(300).optional(),
});

export async function logExpenseAction(
  budgetId: string,
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  let session;
  try { session = await requireBudgetRole(); } catch (e) { return { success: false, error: userMessage(e) }; }
  if (!await isTeamBudget(budgetId, session.user.teamId!)) return { success: false, error: "Budget not found." };

  const parsed = ExpenseSchema.safeParse({
    date: formData.get("date"),
    amount: formData.get("amount"),
    vendor: formData.get("vendor") || undefined,
    description: formData.get("description"),
    paymentMethod: formData.get("paymentMethod") || undefined,
    categoryId: formData.get("categoryId") || undefined,
  });
  if (!parsed.success) return { success: false, error: "Please fill in all required fields." };

  if (parsed.data.categoryId) {
    const category = await prisma.budgetCategory.findFirst({ where: { id: parsed.data.categoryId, budgetId }, select: { id: true } });
    if (!category) return { success: false, error: "Category not found." };
  }

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
