"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { auth, signIn } from "@/lib/auth";
import { z } from "zod";
import { memberAwaitingApproval, teamAwaitingApproval } from "@/lib/notify/events";
import { AuthError } from "next-auth";
import { rateLimit, TOO_MANY } from "@/lib/security/rate-limit";
import { clientIp } from "@/lib/security/request";
import { safeEqual } from "@/lib/security/crypto";
import { sendVerificationEmail } from "@/lib/notify/auth-emails";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { TERMS_REQUIRED } from "@/components/legal/TermsCheckbox";
import { fullNameSchema } from "@/lib/names";
import { linkNewMember } from "@/lib/parents";
import { suggestedSubcategories } from "@/lib/inventory/categories";

const RegisterSchema = z.object({
  name: fullNameSchema,
  email: z.string().trim().toLowerCase().email("Invalid email address").max(254, "Email is too long"),
  password: z.string().min(8, "Password must be at least 8 characters").max(200, "Password is too long"),
  teamNumber: z.coerce.number().int().min(1, "Enter a valid FRC team number").max(99999, "Enter a valid FRC team number"),
  accessCode: z.string().trim().max(100).optional(),
  registrationNote: z.string().trim().max(500, "Keep the message under 500 characters").optional(),
  /** Parents: whose parent they are */
  parentOf: z.string().trim().max(300, "Keep it under 300 characters").optional(),
});

export type RegisterState =
  | { success: true; activated: boolean; newTeam?: boolean }
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
    parentOf: formData.get("parentOf") || undefined,
  };

  if (formData.get("acceptTerms") !== "on") return { success: false, error: TERMS_REQUIRED };
  const parsed = RegisterSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: "Please fix the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const { name, email, password, teamNumber, accessCode, registrationNote, parentOf } = parsed.data;

  // 5 sign-ups per hour from one address (also limits pending-team spam)
  if (!await rateLimit(`register:ip:${await clientIp()}`, 5, 60 * 60)) return { success: false, error: TOO_MANY };

  const existing = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true } });
  if (existing) {
    return { success: false, error: "An account with this email already exists." };
  }

  const hashed = await bcrypt.hash(password, 12);
  const result = await joinTeamOnRegistration({ name, teamNumber, accessCode, registrationNote, parentOf, create: { email, password: hashed } });

  // Ask them to confirm the address (needed before Google/Discord can link to this account)
  if (result.success) {
    const created = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (created) after(() => sendVerificationEmail(created.id).then(() => undefined));
  }
  return result;
}

/**
 * The team part of registering: find (or create, awaiting a super admin) the team, then
 * either create the account (`create`) or attach an account that signed up with Google or
 * Discord (`userId`). A matching access code approves them as a Team Member straight away.
 */
async function joinTeamOnRegistration(opts: {
  name: string;
  teamNumber: number;
  accessCode?: string;
  registrationNote?: string;
  parentOf?: string;
  create?: { email: string; password: string };
  userId?: string;
}): Promise<RegisterState> {
  const { name, teamNumber, accessCode, registrationNote, parentOf } = opts;

  // Find or create team. A team that's new to FRC Manager waits for a super admin to
  // approve it; its first member becomes Head Mentor when it's approved.
  let team = await prisma.team.findUnique({ where: { teamNumber } });
  const newTeam = !team;
  if (!team) {
    team = await prisma.team.create({
      data: { teamNumber, name: `Team ${teamNumber}`, status: "PENDING", inventorySubcategories: { create: suggestedSubcategories() } },
    });
  }
  if (team.status === "DENIED") {
    return { success: false, error: `Team ${teamNumber} can't be registered on FRC Manager. Contact the FRC Manager admins if you think this is a mistake.` };
  }

  // Access code check: auto-approve as TEAM_MEMBER. Guesses are limited per team and caller.
  let codeMatch = false;
  if (accessCode && team.accessCode) {
    if (!await rateLimit(`accesscode:${team.id}:${await clientIp()}`, 10, 60 * 60)) return { success: false, error: TOO_MANY };
    codeMatch = safeEqual(accessCode, team.accessCode);
  }
  const data = {
    name,
    teamId: team.id,
    registrationNote,
    parentOf: parentOf || null,
    // Both callers check the Terms checkbox first
    termsAcceptedAt: new Date(),
    status: codeMatch ? ("ACTIVE" as const) : ("PENDING" as const),
    ...(codeMatch ? { approvedAt: new Date() } : {}),
  };

  let userId = opts.userId;
  if (opts.create) {
    ({ id: userId } = await prisma.user.create({
      select: { id: true },
      data: { ...data, ...opts.create, roles: codeMatch ? { create: { role: "TEAM_MEMBER" } } : undefined },
    }));
  } else if (opts.userId) {
    await prisma.$transaction([
      prisma.user.update({ where: { id: opts.userId }, data }),
      ...(codeMatch ? [prisma.userRole.createMany({ data: [{ userId: opts.userId, role: "TEAM_MEMBER" as const }], skipDuplicates: true })] : []),
    ]);
  }

  // Joined straight away as a student: link the parents who named them
  if (codeMatch && userId) await linkNewMember(team.id, userId);

  if (newTeam) {
    await teamAwaitingApproval(teamNumber, name);
  } else if (!codeMatch && team.status === "ACTIVE") {
    // (A team still awaiting approval has no Head Mentor yet; its founder reviews these later)
    await memberAwaitingApproval(team.id, name);
  }

  return { success: true, activated: codeMatch, newTeam };
}

const FinishSchema = RegisterSchema.pick({ name: true, teamNumber: true, accessCode: true, registrationNote: true, parentOf: true });

/** Signed up with Google or Discord: pick the team to join (the account already exists). */
export async function finishRegistrationAction(
  _prev: RegisterState | null,
  formData: FormData
): Promise<RegisterState> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Your sign-in expired. Sign in again to finish." };

  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true, teamId: true, status: true } });
  if (!me) return { success: false, error: "Account not found." };
  if (me.teamId) return { success: false, error: "You've already chosen a team." };
  if (me.status !== "PENDING") return { success: false, error: "This account can't join a team." };
  if (formData.get("acceptTerms") !== "on") return { success: false, error: TERMS_REQUIRED };

  const parsed = FinishSchema.safeParse({
    name: formData.get("name"),
    teamNumber: formData.get("teamNumber"),
    accessCode: formData.get("accessCode") || undefined,
    registrationNote: formData.get("registrationNote") || undefined,
    parentOf: formData.get("parentOf") || undefined,
  });
  if (!parsed.success) {
    return {
      success: false,
      error: "Please fix the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  return joinTeamOnRegistration({ ...parsed.data, userId: me.id });
}

export type LoginState =
  | { success: true }
  | { success: false; error: string };

/**
 * Signed in and waiting for approval (Google or Discord): take back the request to join — say
 * the wrong team was picked — and choose again. A new team they asked for that nobody else is
 * waiting on goes away with it, so its number can register again.
 */
export async function cancelJoinRequestAction(): Promise<{ success: false; error: string }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Your sign-in expired. Sign in again." };
  const me = await prisma.user.findUnique({
    where:  { id: session.user.id },
    select: { id: true, status: true, teamId: true, team: { select: { status: true } } },
  });
  if (!me?.teamId || me.status !== "PENDING") return { success: false, error: "There's no request to cancel." };
  const teamId = me.teamId;

  await prisma.$transaction(async (tx) => {
    await tx.parentLink.deleteMany({ where: { OR: [{ parentId: me.id }, { studentId: me.id }] } });
    await tx.user.update({ where: { id: me.id }, data: { teamId: null, registrationNote: null, parentOf: null } });
    if (me.team?.status === "PENDING" && await tx.user.count({ where: { teamId } }) === 0) {
      await tx.team.delete({ where: { id: teamId } });
    }
  });
  redirect("/register/finish");
}

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
