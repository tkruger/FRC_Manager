"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import type { RobotRole, RobotStatus } from "@/generated/prisma";

const RobotSchema = z.object({
  name:         z.string().min(1),
  role:         z.enum(["COMPETITION","PRACTICE","DEMO","RETIRED","OTHER"]),
  status:       z.enum(["ACTIVE_BUILD","ACTIVE_COMPETITION_READY","RETIRED_DISPLAY","RETIRED_STORAGE","DECOMMISSIONED"]).optional(),
  description:  z.string().optional(),
  weightTarget: z.coerce.number().min(0).optional(),
});

export async function updateRobotAction(
  robotId: string,
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.teamId) return { success: false, error: "Not authenticated." };

  const parsed = RobotSchema.safeParse({
    name:         formData.get("name"),
    role:         formData.get("role"),
    status:       formData.get("status") || undefined,
    description:  formData.get("description") || undefined,
    weightTarget: formData.get("weightTarget") || undefined,
  });
  if (!parsed.success) return { success: false, error: "Invalid data." };

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
      description:  parsed.data.description,
      weightTarget: parsed.data.weightTarget,
    },
  });

  revalidatePath("/fleet");
  revalidatePath(`/fleet/${robotId}`);
  return { success: true };
}

export async function logWeightSnapshotAction(
  robotId: string,
  weight: number,
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session) return { success: false, error: "Not authenticated." };

  await prisma.weightSnapshot.create({
    data: { robotId, weight, notes: notes ?? null },
  });

  revalidatePath(`/fleet/${robotId}`);
  return { success: true };
}

export async function archiveRobotAction(robotId: string): Promise<{ success: boolean }> {
  const session = await auth();
  if (!session) return { success: false };
  await prisma.robot.update({ where: { id: robotId }, data: { archived: true } });
  revalidatePath("/fleet");
  return { success: true };
}
