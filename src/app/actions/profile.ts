"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fullNameSchema } from "@/lib/names";

// Email changes go through changeEmailAction (confirmed from the new address)
const ProfileSchema = z.object({
  name: fullNameSchema,
});

export type ProfileActionState =
  | { success: true }
  | { success: false; error: string };

export async function updateProfileAction(
  _prev: ProfileActionState | null,
  formData: FormData
): Promise<ProfileActionState> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Not authenticated." };

  const parsed = ProfileSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Enter your first and last name." };

  await prisma.user.update({
    where: { id: session.user.id },
    data: { name: parsed.data.name },
  });

  revalidatePath("/settings/profile");
  return { success: true };
}

/** Home's Overdue tasks tile: the whole team's tasks, or only their own */
export async function setHomeTeamOverdueAction(on: boolean): Promise<ProfileActionState> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Not authenticated." };
  await prisma.user.update({ where: { id: session.user.id }, data: { homeTeamOverdue: !!on } });
  revalidatePath("/dashboard");
  revalidatePath("/settings/profile");
  return { success: true };
}
