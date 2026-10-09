"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import type { Role } from "@/generated/prisma";
import { createNotification } from "@/lib/notifications";
import { LEADERSHIP_ROLES } from "@/lib/rbac";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.teamId) throw new Error("Not authenticated.");
  const isAdmin = session.user.roles.some((r) => LEADERSHIP_ROLES.includes(r as any));
  if (!isAdmin) throw new Error("Only Head Mentors, Mentors and Team Leadership can manage team members.");
  return session;
}

const ROLE_VALUES: Role[] = [
  "TEAM_MEMBER", "BUILD_LEAD", "INVENTORY_ADMIN", "BUDGET_MANAGER", "SAFETY_CAPTAIN", "TEAM_ADMIN", "TEAM_LEADERSHIP", "MENTOR", "HEAD_MENTOR",
];

/**
 * Shared checks for any role assignment: the target must be on the caller's team,
 * roles must be real, only Head Mentors can grant or remove Head Mentor, and the
 * team can never be left without an active Head Mentor.
 */
async function checkRoleChange(
  actor: { id: string; teamId: string; roles: Role[] },
  userId: string,
  roles: Role[],
): Promise<string | null> {
  if (roles.length === 0) return "Assign at least one role.";
  if (roles.some((r) => !ROLE_VALUES.includes(r))) return "Unknown role.";

  const target = await prisma.user.findFirst({
    where:  { id: userId, teamId: actor.teamId },
    select: { roles: { select: { role: true } } },
  });
  if (!target) return "Member not found.";

  const wasHead = target.roles.some((r) => r.role === "HEAD_MENTOR");
  const isHead  = roles.includes("HEAD_MENTOR");
  if (wasHead !== isHead && !actor.roles.includes("HEAD_MENTOR")) {
    return "Only a Head Mentor can grant or remove the Head Mentor role.";
  }
  if (wasHead && !isHead) {
    const others = await prisma.user.count({
      where: { teamId: actor.teamId, status: "ACTIVE", id: { not: userId }, roles: { some: { role: "HEAD_MENTOR" } } },
    });
    if (others === 0) return "The team needs at least one active Head Mentor.";
  }
  return null;
}

export async function approveMemberAction(
  userId: string,
  roles: Role[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await requireAdmin();
    const invalid = await checkRoleChange({ id: session.user.id, teamId: session.user.teamId!, roles: session.user.roles }, userId, roles);
    if (invalid) return { success: false, error: invalid };

    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId, teamId: session.user.teamId },
        data: { status: "ACTIVE", approvedAt: new Date(), approvedBy: session.user.id },
      }),
      prisma.userRole.deleteMany({ where: { userId } }),
      prisma.userRole.createMany({ data: roles.map((role) => ({ userId, role })) }),
    ]);

    await createNotification({
      userId,
      type: "ACCOUNT_APPROVED",
      topic: "account",
      title: "Your account has been approved! Welcome to the team.",
      linkUrl: "/dashboard",
    });

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

    // Deny is for pending registrations only — active members are suspended instead
    const denied = await prisma.user.updateMany({
      where: { id: userId, teamId: session.user.teamId, status: "PENDING" },
      data: { status: "DENIED", deniedAt: new Date(), deniedReason: reason ?? null },
    });
    if (denied.count === 0) return { success: false, error: "No pending registration found." };

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
    // Previously had no team check: leadership on any team could change anyone's roles
    const invalid = await checkRoleChange({ id: session.user.id, teamId: session.user.teamId!, roles: session.user.roles }, userId, roles);
    if (invalid) return { success: false, error: invalid };

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
    if (userId === session.user.id) return { success: false, error: "You can't suspend yourself." };
    // Suspending a Head Mentor is a Head Mentor decision (and never the last one)
    const target = await prisma.user.findFirst({
      where:  { id: userId, teamId: session.user.teamId },
      select: { roles: { select: { role: true } } },
    });
    if (!target) return { success: false, error: "Member not found." };
    if (target.roles.some((r) => r.role === "HEAD_MENTOR")) {
      const invalid = await checkRoleChange(
        { id: session.user.id, teamId: session.user.teamId!, roles: session.user.roles }, userId, ["TEAM_MEMBER"],
      );
      if (invalid) return { success: false, error: invalid.replace("grant or remove the Head Mentor role", "suspend a Head Mentor") };
    }
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

/**
 * Delete a member. Someone with no history is deleted outright. Someone with history
 * (orders they requested, safety reports, tool checkouts, certifications) can't be removed
 * without breaking those records, so their personal details are erased instead: they show as
 * "Former member", lose every sign-in, role and device, and can never sign in again.
 * Task assignments are removed either way. Same Head Mentor rules as suspending.
 */
export async function deleteMemberAction(userId: string): Promise<{ success: boolean; error?: string; erased?: boolean }> {
  try {
    const session = await requireAdmin();
    if (userId === session.user.id) return { success: false, error: "You can't delete yourself." };
    const teamId = session.user.teamId!;

    const target = await prisma.user.findFirst({
      where:  { id: userId, teamId, deletedAt: null },
      select: {
        name: true,
        roles: { select: { role: true } },
        _count: { select: { purchaseRequests: true, incidentReports: true, toolCheckouts: true, userCertifications: true } },
      },
    });
    if (!target) return { success: false, error: "Member not found." };
    if (target.roles.some((r) => r.role === "HEAD_MENTOR")) {
      const invalid = await checkRoleChange({ id: session.user.id, teamId, roles: session.user.roles }, userId, ["TEAM_MEMBER"]);
      if (invalid) return { success: false, error: invalid.replace("grant or remove the Head Mentor role", "delete a Head Mentor") };
    }

    const c = target._count;
    const hasHistory = c.purchaseRequests + c.incidentReports + c.toolCheckouts + c.userCertifications > 0;

    await prisma.$transaction(async (tx) => {
      // Personal, per-device and per-person things go either way
      await tx.notification.deleteMany({ where: { userId } });
      await tx.user.update({ where: { id: userId }, data: { assignedTasks: { set: [] } } });

      if (!hasHistory) {
        await tx.user.delete({ where: { id: userId } }); // roles, sign-ins, devices, drafts follow (cascade)
        return;
      }
      await tx.userRole.deleteMany({ where: { userId } });
      await tx.account.deleteMany({ where: { userId } });
      await tx.session.deleteMany({ where: { userId } });
      await tx.pushSubscription.deleteMany({ where: { userId } });
      await tx.notificationPreference.deleteMany({ where: { userId } });
      await tx.orderDraft.deleteMany({ where: { userId } });
      await tx.discordLink.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
      await tx.user.update({
        where: { id: userId },
        data: {
          name: "Former member",
          email: `deleted-${userId}@deleted.invalid`,
          password: null, image: null, registrationNote: null, timezone: null,
          isSuperAdmin: false,
          status: "DENIED",
          deniedReason: "Deleted",
          deletedAt: new Date(),
        },
      });
    });

    revalidatePath("/settings/members");
    return { success: true, erased: hasHistory };
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
