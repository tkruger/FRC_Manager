"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import type { Role } from "@/generated/prisma";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.teamId) throw new Error("Not authenticated.");
  const isAdmin = session.user.roles.some((r) => ["HEAD_MENTOR", "INVENTORY_ADMIN"].includes(r));
  if (!isAdmin) throw new Error("Not authorized.");
  return session;
}

export async function approveMemberAction(
  userId: string,
  roles: Role[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await requireAdmin();
    if (roles.length === 0) return { success: false, error: "Assign at least one role." };

    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId, teamId: session.user.teamId },
        data: { status: "ACTIVE", approvedAt: new Date(), approvedBy: session.user.id },
      }),
      prisma.userRole.deleteMany({ where: { userId } }),
      prisma.userRole.createMany({ data: roles.map((role) => ({ userId, role })) }),
    ]);

    revalidatePath("/settings/members");
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function denyMemberAction(
  userId: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await requireAdmin();

    await prisma.user.update({
      where: { id: userId, teamId: session.user.teamId },
      data: { status: "DENIED", deniedAt: new Date(), deniedReason: reason ?? null },
    });

    revalidatePath("/settings/members");
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function updateMemberRolesAction(
  userId: string,
  roles: Role[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await requireAdmin();
    if (roles.length === 0) return { success: false, error: "Assign at least one role." };

    await prisma.$transaction([
      prisma.userRole.deleteMany({ where: { userId } }),
      prisma.userRole.createMany({ data: roles.map((role) => ({ userId, role })) }),
    ]);

    revalidatePath("/settings/members");
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function suspendMemberAction(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await requireAdmin();
    await prisma.user.update({
      where: { id: userId, teamId: session.user.teamId },
      data: { status: "SUSPENDED" },
    });
    revalidatePath("/settings/members");
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function updateTeamAccessCodeAction(
  code: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await requireAdmin();
    await prisma.team.update({
      where: { id: session.user.teamId },
      data: { accessCode: code || null },
    });
    revalidatePath("/settings/members");
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
