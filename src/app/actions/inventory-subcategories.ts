"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { CATEGORY_VALUES, SUGGESTED_SUBCATEGORIES, type CategoryValue } from "@/lib/inventory/categories";
import { plainArgs } from "@/lib/action-args";

// Inventory → Sub-categories: the team's sub-categories of each category (Gears, Belts, … under
// Mechanical). Inventory Admins and Head Mentors set them up.

type Result = { success: boolean; error?: string };

const Name = z.string().trim().min(1, "Give it a name.").max(60, "Keep the name under 60 characters.");

async function manager() {
  const session = await auth();
  if (!session?.user?.teamId) return null;
  if (!session.user.roles.some((r) => ["INVENTORY_ADMIN", "HEAD_MENTOR"].includes(r))) return null;
  return session.user.teamId;
}

const done = (): Result => {
  revalidatePath("/inventory", "layout");
  return { success: true };
};

/** Same name in the same category, ignoring case */
async function taken(teamId: string, category: CategoryValue, name: string, except?: string) {
  return !!(await prisma.inventorySubcategory.findFirst({
    where: { teamId, category, name: { equals: name, mode: "insensitive" }, ...(except ? { id: { not: except } } : {}) },
    select: { id: true },
  }));
}

export async function addSubcategoryAction(category: string, name: string): Promise<Result> {
  plainArgs(category, name);
  const teamId = await manager();
  if (!teamId) return { success: false, error: "Only Inventory Admins and Head Mentors can change sub-categories." };
  const cat = z.enum(CATEGORY_VALUES).safeParse(category);
  const n = Name.safeParse(name);
  if (!cat.success) return { success: false, error: "That isn't a category." };
  if (!n.success) return { success: false, error: n.error.issues[0].message };
  if (await taken(teamId, cat.data, n.data)) return { success: false, error: `There's already a ${n.data} sub-category there.` };
  await prisma.inventorySubcategory.create({ data: { teamId, category: cat.data, name: n.data } });
  return done();
}

export async function renameSubcategoryAction(id: string, name: string): Promise<Result> {
  plainArgs(id, name);
  const teamId = await manager();
  if (!teamId) return { success: false, error: "Only Inventory Admins and Head Mentors can change sub-categories." };
  const n = Name.safeParse(name);
  if (!n.success) return { success: false, error: n.error.issues[0].message };
  const sub = await prisma.inventorySubcategory.findFirst({ where: { id, teamId }, select: { category: true } });
  if (!sub) return { success: false, error: "That sub-category is gone." };
  if (await taken(teamId, sub.category as CategoryValue, n.data, id)) return { success: false, error: `There's already a ${n.data} sub-category there.` };
  await prisma.inventorySubcategory.update({ where: { id }, data: { name: n.data } });
  return done();
}

/** Remove a sub-category. Its items stay in the category, without a sub-category. */
export async function deleteSubcategoryAction(id: string): Promise<Result> {
  plainArgs(id);
  const teamId = await manager();
  if (!teamId) return { success: false, error: "Only Inventory Admins and Head Mentors can change sub-categories." };
  const res = await prisma.inventorySubcategory.deleteMany({ where: { id, teamId } });
  if (!res.count) return { success: false, error: "That sub-category is gone." };
  return done();
}

/** Add the suggested sub-categories a category doesn't have yet */
export async function addSuggestedSubcategoriesAction(category: string): Promise<Result & { added?: number }> {
  plainArgs(category);
  const teamId = await manager();
  if (!teamId) return { success: false, error: "Only Inventory Admins and Head Mentors can change sub-categories." };
  const cat = z.enum(CATEGORY_VALUES).safeParse(category);
  if (!cat.success) return { success: false, error: "That isn't a category." };
  const have = new Set((await prisma.inventorySubcategory.findMany({ where: { teamId, category: cat.data }, select: { name: true } })).map((s) => s.name.toLowerCase()));
  const add = (SUGGESTED_SUBCATEGORIES[cat.data] ?? []).filter((n) => !have.has(n.toLowerCase()));
  if (add.length) await prisma.inventorySubcategory.createMany({ data: add.map((name) => ({ teamId, category: cat.data, name })), skipDuplicates: true });
  return { ...done(), added: add.length };
}
