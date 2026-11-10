"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LEADERSHIP_ROLES } from "@/lib/rbac";
import { isViewOnly } from "@/lib/access/read-only";
import { SUBTEAM_OPTIONS } from "@/lib/schedule-helpers";
import type { Role, SubTeam } from "@/generated/prisma";
import { plainArgs } from "@/lib/action-args";

/**
 * Set someone's sub-teams (any number). Anyone can set their own; Head Mentors and Team Leadership
 * can set anyone's on their team. Sub-team meetings remind these members.
 */
export async function setSubTeamsAction(userId: string, subTeams: string[]): Promise<{ success: true } | { success: false; error: string }> {
  plainArgs(userId, subTeams);
  const session = await auth();
  if (!session?.user?.teamId) return { success: false, error: "Not signed in." };
  const self = userId === session.user.id;
  if (!self && !session.user.roles.some((r) => LEADERSHIP_ROLES.includes(r as Role))) {
    return { success: false, error: "Only Head Mentors and Team Leadership can change someone else's sub-teams." };
  }
  if (self && isViewOnly(session.user.roles)) return { success: false, error: "Sub-teams are for students and mentors." };
  const valid = new Set(SUBTEAM_OPTIONS.map((o) => o.value));
  const picked = [...new Set(subTeams)];
  if (picked.some((s) => !valid.has(s))) return { success: false, error: "Unknown sub-team." };

  const { count } = await prisma.user.updateMany({
    where: { id: userId, teamId: session.user.teamId },
    data:  { subTeams: picked as SubTeam[] },
  });
  if (count === 0) return { success: false, error: "Member not found." };
  revalidatePath("/settings/members");
  revalidatePath("/settings/profile");
  return { success: true };
}
