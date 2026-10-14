"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// Email changes go through changeEmailAction (confirmed from the new address)
const ProfileSchema = z.object({
  name: z.string().trim().min(1).max(100),
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
  if (!parsed.success) return { success: false, error: "Please enter your name (up to 100 characters)." };

  await prisma.user.update({
    where: { id: session.user.id },
    data: { name: parsed.data.name },
  });

  revalidatePath("/settings/profile");
  return { success: true };
}
