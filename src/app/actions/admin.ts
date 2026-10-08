"use server";

// Platform administration (super admins): approving teams that are new to FRC Manager,
// and managing who else is a super admin. Not tied to any one team.

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { teamApproved } from "@/lib/notify/events";

type Result = { success: true; message?: string } | { success: false; error: string };

/** The signed-in user, if they're an active super admin (checked in the database, not the session) */
async function requireSuperAdmin() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const me = await prisma.user.findUnique({
    where:  { id: session.user.id },
    select: { id: true, name: true, isSuperAdmin: true, status: true },
  });
  return me?.isSuperAdmin && me.status === "ACTIVE" ? me : null;
}

function refresh() {
  revalidatePath("/settings/admin");
}

/**
 * Approve a new team: it becomes active, and the person who registered it (its first
 * member) is approved as its Head Mentor. Anyone else who registered for the team in the
 * meantime stays pending for that Head Mentor to review.
 */
export async function approveTeamAction(teamId: string): Promise<Result> {
  const me = await requireSuperAdmin();
  if (!me) return { success: false, error: "Only super admins can approve teams." };

  const team = await prisma.team.findUnique({
    where:  { id: teamId },
    select: { id: true, teamNumber: true, status: true, users: { where: { status: "PENDING" }, orderBy: { createdAt: "asc" }, take: 1, select: { id: true, name: true } } },
  });
  if (!team) return { success: false, error: "Team not found." };
  if (team.status !== "PENDING") return { success: false, error: "This team has already been reviewed." };
  const founder = team.users[0];

  await prisma.$transaction(async (tx) => {
    await tx.team.update({ where: { id: team.id }, data: { status: "ACTIVE", reviewedAt: new Date(), reviewedById: me.id } });
    if (founder) {
      await tx.user.update({ where: { id: founder.id }, data: { status: "ACTIVE" } });
      await tx.userRole.createMany({ data: [{ userId: founder.id, role: "HEAD_MENTOR" }], skipDuplicates: true });
    }
  });
  if (founder) await teamApproved(founder.id, team.teamNumber);

  refresh();
  return { success: true, message: founder ? `Team ${team.teamNumber} approved — ${founder.name} is its Head Mentor.` : `Team ${team.teamNumber} approved.` };
}

/** Deny a new team: it can't be used, and everyone waiting to join it is denied. */
export async function denyTeamAction(teamId: string): Promise<Result> {
  const me = await requireSuperAdmin();
  if (!me) return { success: false, error: "Only super admins can deny teams." };

  const team = await prisma.team.findUnique({ where: { id: teamId }, select: { id: true, teamNumber: true, status: true } });
  if (!team) return { success: false, error: "Team not found." };
  if (team.status !== "PENDING") return { success: false, error: "This team has already been reviewed." };

  await prisma.$transaction([
    prisma.team.update({ where: { id: team.id }, data: { status: "DENIED", reviewedAt: new Date(), reviewedById: me.id } }),
    prisma.user.updateMany({ where: { teamId: team.id, status: "PENDING" }, data: { status: "DENIED" } }),
  ]);

  refresh();
  return { success: true, message: `Team ${team.teamNumber} denied.` };
}

/** Make an existing user a super admin, by email. */
export async function grantSuperAdminAction(email: string): Promise<Result> {
  const me = await requireSuperAdmin();
  if (!me) return { success: false, error: "Only super admins can add super admins." };

  const user = await prisma.user.findFirst({
    where:  { email: { equals: email.trim(), mode: "insensitive" } },
    select: { id: true, name: true, isSuperAdmin: true, status: true },
  });
  if (!user) return { success: false, error: "No FRC Manager account uses that email." };
  if (user.status !== "ACTIVE") return { success: false, error: `${user.name}'s account isn't active.` };
  if (user.isSuperAdmin) return { success: false, error: `${user.name} is already a super admin.` };

  await prisma.user.update({ where: { id: user.id }, data: { isSuperAdmin: true } });
  refresh();
  return { success: true, message: `${user.name} is now a super admin.` };
}

/** Remove a super admin. There's always at least one left. */
export async function revokeSuperAdminAction(userId: string): Promise<Result> {
  const me = await requireSuperAdmin();
  if (!me) return { success: false, error: "Only super admins can remove super admins." };

  const others = await prisma.user.count({ where: { isSuperAdmin: true, status: "ACTIVE", id: { not: userId } } });
  if (others === 0) return { success: false, error: "There has to be at least one super admin." };

  const user = await prisma.user.update({ where: { id: userId }, data: { isSuperAdmin: false }, select: { name: true } });
  refresh();
  return { success: true, message: `${user.name} is no longer a super admin.` };
}
