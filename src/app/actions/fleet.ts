"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import type { RobotRole, RobotStatus } from "@/generated/prisma";
import { ROBOT_EDIT_ROLES } from "@/lib/rbac";

const RobotSchema = z.object({
  name:         z.string().trim().min(1, "Enter a robot name.").max(60),
  role:         z.enum(["COMPETITION","PRACTICE","DEMO","RETIRED","OTHER"]),
  status:       z.enum(["ACTIVE_BUILD","ACTIVE_COMPETITION_READY","RETIRED_DISPLAY","RETIRED_STORAGE","DECOMMISSIONED"]).optional(),
  description:  z.string().trim().max(1000).optional(),
  weightTarget: z.coerce.number().positive("Weight target must be more than 0.").max(500).optional(),
});

export async function updateRobotAction(
  robotId: string,
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.teamId) return { success: false, error: "Not authenticated." };
  if (!session.user.roles.some((r) => ROBOT_EDIT_ROLES.includes(r))) {
    return { success: false, error: "Only Head Mentors, Team Leadership and Build Leads can edit robots." };
  }

  const parsed = RobotSchema.safeParse({
    name:         formData.get("name"),
    role:         formData.get("role"),
    status:       formData.get("status") || undefined,
    description:  formData.get("description") || undefined,
    weightTarget: formData.get("weightTarget") || undefined,
  });
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid data." };

  const robot = await prisma.robot.findFirst({
    where: { id: robotId, season: { teamId: session.user.teamId } },
    select: { year: true, seasonId: true },
  });
  if (!robot) return { success: false, error: "Robot not found." };

  await prisma.robot.update({
    where: { id: robotId },
    data: {
      name:         parsed.data.name,
      displayName:  `${robot.year} ${parsed.data.name}`,
      role:         parsed.data.role as RobotRole,
      status:       parsed.data.status as RobotStatus | undefined,
      // Blank fields clear the value (blank weight target = default 115 lb limit)
      description:  parsed.data.description || null,
      weightTarget: parsed.data.weightTarget ?? null,
    },
  });

  // displayName shows in the nav robot picker, settings and task filters too
  revalidatePath("/", "layout");
  return { success: true };
}

export async function logWeightSnapshotAction(
  robotId: string,
  weight: number,
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.teamId) return { success: false, error: "Not authenticated." };
  if (!Number.isFinite(weight) || weight <= 0) return { success: false, error: "Enter a valid weight." };

  const robot = await prisma.robot.findFirst({ where: { id: robotId, season: { teamId: session.user.teamId } }, select: { id: true } });
  if (!robot) return { success: false, error: "Robot not found." };

  await prisma.weightSnapshot.create({
    data: { robotId, weight, notes: notes ?? null },
  });

  revalidatePath(`/fleet/${robotId}`);
  return { success: true };
}

export async function archiveRobotAction(robotId: string): Promise<{ success: boolean }> {
  // Same rule as creating robots (Season settings): Head Mentors only
  const session = await auth();
  if (!session?.user?.teamId || !session.user.roles.includes("HEAD_MENTOR")) return { success: false };
  const archived = await prisma.robot.updateMany({
    where: { id: robotId, season: { teamId: session.user.teamId } },
    data:  { archived: true },
  });
  if (archived.count === 0) return { success: false };
  revalidatePath("/fleet");
  return { success: true };
}
