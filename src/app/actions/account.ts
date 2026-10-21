"use server";

// Account security: forgot/reset password, change password, verify email, change email,
// and sign out of every device. Every request that sends email or checks a password is
// rate limited.

import bcrypt from "bcryptjs";
import { z } from "zod";
import { issueMessage } from "@/lib/validation";
import { AuthError } from "next-auth";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth, signIn, signOut } from "@/lib/auth";
import { rateLimitAll, rateLimit, clearRateLimit, TOO_MANY } from "@/lib/security/rate-limit";
import { clientIp } from "@/lib/security/request";
import { consumeAuthToken } from "@/lib/security/auth-tokens";
import { sendPasswordResetEmail, sendVerificationEmail, sendEmailChangeEmail } from "@/lib/notify/auth-emails";

type Result = { success: true; message?: string } | { success: false; error: string };

const Password = z.string().min(8, "Use at least 8 characters.").max(200, "That password is too long.");
const Email = z.string().trim().toLowerCase().email("Enter a valid email address.").max(254);

async function me() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return prisma.user.findUnique({
    where:  { id: session.user.id },
    select: { id: true, email: true, password: true, emailVerified: true },
  });
}

// ── Forgot / reset password ─────────────────────────────────────────────────

/** Email a reset link. Always answers the same way, so it never reveals who has an account. */
export async function requestPasswordResetAction(rawEmail: string): Promise<Result> {
  const parsed = Email.safeParse(rawEmail);
  if (!parsed.success) return { success: false, error: issueMessage(parsed.error) };
  const email = parsed.data;

  const allowed = await rateLimitAll([
    [`reset:email:${email}`, 3, 60 * 60],
    [`reset:ip:${await clientIp()}`, 10, 60 * 60],
  ]);
  if (!allowed) return { success: false, error: TOO_MANY };

  const user = await prisma.user.findFirst({
    where:  { email: { equals: email, mode: "insensitive" }, deletedAt: null, status: { in: ["ACTIVE", "PENDING"] } },
    select: { id: true },
  });
  if (user) await sendPasswordResetEmail(user.id);

  return { success: true, message: "If that email has an FRC Manager account, a reset link is on its way. Check your inbox (and spam)." };
}

/** Set a new password from an emailed link. Signs out every other session. */
export async function resetPasswordAction(token: string, newPassword: string): Promise<Result> {
  const parsed = Password.safeParse(newPassword);
  if (!parsed.success) return { success: false, error: issueMessage(parsed.error) };
  if (!await rateLimit(`reset-submit:ip:${await clientIp()}`, 20, 60 * 60)) return { success: false, error: TOO_MANY };

  const row = await consumeAuthToken(token, "PASSWORD_RESET");
  if (!row) return { success: false, error: "This reset link has expired or was already used. Ask for a new one." };

  const user = await prisma.user.update({
    where: { id: row.userId },
    data: {
      password:       await bcrypt.hash(parsed.data, 12),
      sessionVersion: { increment: 1 },
      // They opened a link sent to this address, so it's theirs
      emailVerified:  new Date(),
    },
    select: { email: true },
  });
  await clearRateLimit(`login:email:${user.email.toLowerCase()}`);
  return { success: true, message: "Password changed. Sign in with your new password." };
}

// ── Change password (signed in) ─────────────────────────────────────────────

/**
 * Change (or, for Google/Discord-only accounts, set) the password. Every other device is
 * signed out; this one is signed straight back in.
 */
export async function changePasswordAction(currentPassword: string, newPassword: string): Promise<Result> {
  const user = await me();
  if (!user) return { success: false, error: "Sign in first." };
  const parsed = Password.safeParse(newPassword);
  if (!parsed.success) return { success: false, error: issueMessage(parsed.error) };
  if (!await rateLimit(`pwchange:user:${user.id}`, 5, 15 * 60)) return { success: false, error: TOO_MANY };

  if (user.password && !(await bcrypt.compare(currentPassword.slice(0, 200), user.password))) {
    return { success: false, error: "Your current password isn't right." };
  }

  await prisma.user.update({
    where: { id: user.id },
    data:  { password: await bcrypt.hash(parsed.data, 12), sessionVersion: { increment: 1 } },
  });

  try {
    await signIn("credentials", { email: user.email, password: parsed.data, redirect: false });
  } catch (e) {
    if (!(e instanceof AuthError)) throw e;
    return { success: true, message: "Password changed. Please sign in again." };
  }
  return { success: true, message: user.password ? "Password changed. Other devices have been signed out." : "Password set. You can now sign in with your email and password too." };
}

// ── Email verification ─────────────────────────────────────────────────────

export async function sendVerificationAction(): Promise<Result> {
  const user = await me();
  if (!user) return { success: false, error: "Sign in first." };
  if (user.emailVerified) return { success: true, message: "Your email is already confirmed." };
  if (!await rateLimit(`verify:user:${user.id}`, 3, 60 * 60)) return { success: false, error: TOO_MANY };

  const sent = await sendVerificationEmail(user.id);
  return sent
    ? { success: true, message: `Confirmation link sent to ${user.email}.` }
    : { success: false, error: "Couldn't send the email right now. Try again later." };
}

// ── Change email ───────────────────────────────────────────────────────────

/**
 * Start an email change: a confirmation link goes to the new address, and the account's
 * email changes only when it's clicked. Needs the current password if the account has one.
 */
export async function changeEmailAction(rawEmail: string, currentPassword: string): Promise<Result> {
  const user = await me();
  if (!user) return { success: false, error: "Sign in first." };
  const parsed = Email.safeParse(rawEmail);
  if (!parsed.success) return { success: false, error: issueMessage(parsed.error) };
  const email = parsed.data;
  if (email === user.email.toLowerCase()) return { success: false, error: "That's already your email." };
  if (!await rateLimit(`emailchange:user:${user.id}`, 5, 60 * 60)) return { success: false, error: TOO_MANY };

  if (user.password && !(await bcrypt.compare(currentPassword.slice(0, 200), user.password))) {
    return { success: false, error: "Your current password isn't right." };
  }
  const taken = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" }, id: { not: user.id } }, select: { id: true } });
  if (taken) return { success: false, error: "That email is already used by another account." };

  const res = await sendEmailChangeEmail(user.id, email);
  return res.sent
    ? { success: true, message: `Check ${email} for a confirmation link. Your email changes when you click it.` }
    : { success: false, error: "Couldn't send the confirmation email right now. Try again later." };
}

// ── Sessions ───────────────────────────────────────────────────────────────

/** Sign out of every device, including this one */
export async function signOutEverywhereAction(): Promise<void> {
  const user = await me();
  if (user) await prisma.user.update({ where: { id: user.id }, data: { sessionVersion: { increment: 1 } } });
  revalidatePath("/", "layout");
  await signOut({ redirectTo: "/login" });
}
