// Account emails: verify your address, reset your password, confirm a new address.
// Server-only. Each returns whether it was sent (callers may show a fallback message).

import { prisma } from "@/lib/prisma";
import { appUrl } from "@/lib/app-url";
import { sendEmail, escapeHtml } from "@/lib/email";
import { createAuthToken } from "@/lib/security/auth-tokens";

function layout(first: string, intro: string, button: string, url: string, footer: string) {
  return `<div style="font-family:system-ui,sans-serif;max-width:480px;line-height:1.5;color:#1f2430">
    <p>Hi ${escapeHtml(first)},</p>
    <p>${escapeHtml(intro)}</p>
    <p><a href="${url}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">${escapeHtml(button)}</a></p>
    <p style="font-size:13px;color:#555">If the button doesn't work, open: ${url}</p>
    <p style="font-size:13px;color:#555">${escapeHtml(footer)}</p>
  </div>`;
}

const firstName = (name: string) => name.split(" ")[0] || name;

/** "Confirm your email address" — proves the address belongs to the account's owner */
export async function sendVerificationEmail(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true, emailVerified: true } });
  if (!user || user.emailVerified || user.email.endsWith(".invalid")) return false;
  const token = await createAuthToken(userId, "EMAIL_VERIFY");
  const url = `${appUrl()}/verify-email/${token}`;
  const intro = "Please confirm this is your email address for FRC Manager.";
  const footer = "The link works for 24 hours. If you didn't create an FRC Manager account, you can ignore this email.";
  const res = await sendEmail({
    to: user.email,
    subject: "Confirm your email for FRC Manager",
    text: `Hi ${firstName(user.name)},\n\n${intro}\n\n${url}\n\n${footer}`,
    html: layout(firstName(user.name), intro, "Confirm email", url, footer),
  });
  if (!res.sent) console.warn(`[email] Verification email not sent (user ${userId}): ${res.error}`);
  return res.sent;
}

/** "Reset your password" */
export async function sendPasswordResetEmail(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } });
  if (!user || user.email.endsWith(".invalid")) return false;
  const token = await createAuthToken(userId, "PASSWORD_RESET");
  const url = `${appUrl()}/reset-password/${token}`;
  const intro = "Someone asked to reset the password for your FRC Manager account. Choose a new one here:";
  const footer = "The link works for 30 minutes. If you didn't ask for this, ignore this email — your password stays the same.";
  const res = await sendEmail({
    to: user.email,
    subject: "Reset your FRC Manager password",
    text: `Hi ${firstName(user.name)},\n\n${intro}\n\n${url}\n\n${footer}`,
    html: layout(firstName(user.name), intro, "Choose a new password", url, footer),
  });
  if (!res.sent) console.warn(`[email] Password reset email not sent (user ${userId}): ${res.error}`);
  return res.sent;
}

/** "Confirm your new email address" — sent to the new address; the change happens on click */
export async function sendEmailChangeEmail(userId: string, newEmail: string): Promise<{ sent: boolean; error?: string }> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
  if (!user) return { sent: false, error: "Account not found." };
  const token = await createAuthToken(userId, "EMAIL_CHANGE", newEmail);
  const url = `${appUrl()}/verify-email/${token}?change=1`;
  const intro = `Confirm ${newEmail} as the new email address for your FRC Manager account.`;
  const footer = "The link works for an hour. Until you confirm, your account keeps its current email.";
  const res = await sendEmail({
    to: newEmail,
    subject: "Confirm your new email for FRC Manager",
    text: `Hi ${firstName(user.name)},\n\n${intro}\n\n${url}\n\n${footer}`,
    html: layout(firstName(user.name), intro, "Confirm new email", url, footer),
  });
  if (!res.sent) console.warn(`[email] Email-change confirmation not sent (user ${userId}): ${res.error}`);
  return res;
}
