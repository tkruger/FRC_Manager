"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signIn } from "@/lib/auth";
import { z } from "zod";
import { AuthError } from "next-auth";

const RegisterSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  teamNumber: z.coerce.number().int().min(1, "Enter a valid FRC team number"),
  accessCode: z.string().optional(),
  registrationNote: z.string().optional(),
});

export type RegisterState =
  | { success: true; activated: boolean }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

export async function registerAction(
  _prev: RegisterState | null,
  formData: FormData
): Promise<RegisterState> {
  const raw = {
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    teamNumber: formData.get("teamNumber"),
    accessCode: formData.get("accessCode") || undefined,
    registrationNote: formData.get("registrationNote") || undefined,
  };

  const parsed = RegisterSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: "Please fix the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const { name, email, password, teamNumber, accessCode, registrationNote } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { success: false, error: "An account with this email already exists." };
  }

  // Find or create team
  let team = await prisma.team.findUnique({ where: { teamNumber } });
  if (!team) {
    team = await prisma.team.create({
      data: { teamNumber, name: `Team ${teamNumber}` },
    });
  }

  const hashed = await bcrypt.hash(password, 12);

  // Access code check: auto-approve as TEAM_MEMBER
  const codeMatch = accessCode && team.accessCode && accessCode === team.accessCode;

  await prisma.user.create({
    data: {
      name,
      email,
      password: hashed,
      teamId: team.id,
      registrationNote,
      status: codeMatch ? "ACTIVE" : "PENDING",
      roles: codeMatch
        ? { create: { role: "TEAM_MEMBER" } }
        : undefined,
    },
  });

  return { success: true, activated: !!codeMatch };
}

export type LoginState =
  | { success: true }
  | { success: false; error: string };

export async function loginAction(
  _prev: LoginState | null,
  formData: FormData
): Promise<LoginState> {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirect: false,
    });
    return { success: true };
  } catch (err) {
    if (err instanceof AuthError) {
      return { success: false, error: "Invalid email or password." };
    }
    return { success: false, error: "Something went wrong. Please try again." };
  }
}
