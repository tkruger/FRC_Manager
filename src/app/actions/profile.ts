"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const ProfileSchema = z.object({
  name:  z.string().min(1).max(100),
  email: z.string().email(),
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

  const parsed = ProfileSchema.safeParse({
    name:  formData.get("name"),
    email: formData.get("email"),
  });

  if (!parsed.success) return { success: false, error: "Please enter a valid name and email." };

  const existing = await prisma.user.findFirst({
    where: { email: parsed.data.email, NOT: { id: session.user.id } },
  });
  if (existing) return { success: false, error: "That email is already in use by another account." };

  await prisma.user.update({
    where: { id: session.user.id },
    data: { name: parsed.data.name, email: parsed.data.email },
  });

  revalidatePath("/settings/profile");
  return { success: true };
}
