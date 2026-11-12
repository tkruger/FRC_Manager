"use server";

// A team's own mail server (Settings → Email, Head Mentors only). Team emails only go out
// through it (none without it); account emails use the app's service.

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { issueMessage } from "@/lib/validation";
import { seal, open } from "@/lib/security/secret-box";
import { verifyMailServer, type MailServer } from "@/lib/team-mail";
import { sendThroughTeam } from "@/lib/team-sender";
import { GmailError, revokeGmail } from "@/lib/gmail-api";
import { parseServiceAccountKey, serviceAccountToken } from "@/lib/google-service-account";
import { MAX_DAILY_LIMIT, MAX_HOURLY_LIMIT } from "@/lib/mail-limits";
import { MAIL_PORTS, PROVIDER_BY_ID, type MailSecurity } from "@/lib/email-providers";
import { escapeHtml } from "@/lib/html";
import { EMAIL_ADMIN_ROLES } from "@/lib/rbac";
import { plainArgs, plainObject } from "@/lib/action-args";

type Result = { success: true } | { success: false; error: string };

async function headMentor() {
  const session = await auth();
  if (!session?.user?.id || !session.user.teamId) return null;
  if (!session.user.roles.some((r) => EMAIL_ADMIN_ROLES.includes(r))) return null;
  return { id: session.user.id, teamId: session.user.teamId };
}

const Schema = z.object({
  provider:  z.string().refine((p) => p in PROVIDER_BY_ID, "Pick an email provider."),
  host:      z.string().trim().min(3, "Enter the mail server.").max(253),
  port:      z.number().int().refine((p) => MAIL_PORTS.includes(p), `Use a mail port (${MAIL_PORTS.join(", ")}).`),
  security:  z.enum(["ssl", "starttls"]),
  username:  z.string().trim().min(1, "Enter the username (usually the email address).").max(254),
  /** Blank keeps the saved password */
  password:  z.string().max(500).optional(),
  fromName:  z.string().trim().max(100).optional(),
  fromEmail: z.string().trim().email("Enter the email address messages come from.").max(254),
});

/** Check the settings by logging in to the server, then save them */
export async function saveEmailServerAction(input: unknown): Promise<Result> {
  const who = await headMentor();
  if (!who) return { success: false, error: "Only Head Mentors and Integration Admins can set up the team's email." };
  const parsed = Schema.safeParse(input);
  if (!parsed.success) return { success: false, error: issueMessage(parsed.error) };
  const d = parsed.data;
  // Gmail connects with Google (the Gmail API), not a mail server password
  if (PROVIDER_BY_ID[d.provider]?.google) return { success: false, error: "Gmail connects with Google — use Connect with Google." };

  const existing = await prisma.teamEmailServer.findUnique({ where: { teamId: who.teamId } });
  const password = d.password?.trim() ? d.password.trim() : existing?.passwordEnc ? open(existing.passwordEnc) : null;
  if (!password) return { success: false, error: existing ? "Enter the password again — the saved one can't be read." : "Enter the password." };

  const server: MailServer = {
    host: d.host.toLowerCase(), port: d.port, security: d.security as MailSecurity,
    username: d.username, password, fromName: d.fromName || null, fromEmail: d.fromEmail.toLowerCase(),
  };
  const check = await verifyMailServer(server);
  if (!check.ok) return { success: false, error: check.error };

  const data = {
    provider: d.provider, method: "smtp", host: server.host, port: server.port, security: server.security,
    username: server.username, passwordEnc: seal(password), fromName: server.fromName, fromEmail: server.fromEmail,
    // Switching from Gmail or a service account: drop the Google connection
    refreshTokenEnc: null, googleEmail: null, serviceKeyEnc: null, serviceAccountEmail: null,
    enabled: true, lastError: null, lastErrorAt: null, updatedById: who.id,
  };
  if (existing?.refreshTokenEnc) {
    const old = open(existing.refreshTokenEnc);
    if (old) await revokeGmail(old);
  }
  await prisma.teamEmailServer.upsert({ where: { teamId: who.teamId }, create: { teamId: who.teamId, ...data }, update: data });
  revalidatePath("/settings/email");
  return { success: true };
}

/** Send a test message to yourself through the team's server (no fallback, so problems show) */
export async function sendTestEmailAction(): Promise<Result & { to?: string }> {
  const who = await headMentor();
  if (!who) return { success: false, error: "Only Head Mentors and Integration Admins can set up the team's email." };
  const [server, me, team] = await Promise.all([
    prisma.teamEmailServer.findUnique({ where: { teamId: who.teamId } }),
    prisma.user.findUnique({ where: { id: who.id }, select: { email: true, name: true } }),
    prisma.team.findUnique({ where: { id: who.teamId }, select: { teamNumber: true } }),
  ]);
  if (!server) return { success: false, error: "Set up the team's email first." };
  if (!me || me.email.endsWith(".invalid")) return { success: false, error: "Your account has no email address to send the test to." };

  const line = `This is a test from FRC Manager. Team ${team?.teamNumber ?? ""} emails — notifications, invites and welcomes — will come from ${server.fromEmail}.`;
  const res = await sendThroughTeam(server, {
    to: me.email,
    subject: `Test email from Team ${team?.teamNumber ?? ""}`.trim(),
    text: `${line}\n\nIf you got this, the team's email is working.`,
    html: `<div style="font-family:system-ui,sans-serif;max-width:480px;line-height:1.5;color:#1f2430"><p>${escapeHtml(line)}</p><p>If you got this, the team's email is working. ✅</p></div>`,
  });
  await prisma.teamEmailServer.update({
    where: { teamId: who.teamId },
    data:  res.sent ? { lastSentAt: new Date(), lastError: null, lastErrorAt: null } : { lastError: res.error, lastErrorAt: new Date() },
  });
  revalidatePath("/settings/email");
  return res.sent ? { success: true, to: me.email } : { success: false, error: res.error };
}

/** Pause (no team emails meanwhile) or resume the team's server */
export async function setEmailServerEnabledAction(enabled: boolean): Promise<Result> {
  plainArgs(enabled);
  const who = await headMentor();
  if (!who) return { success: false, error: "Only Head Mentors and Integration Admins can set up the team's email." };
  await prisma.teamEmailServer.updateMany({ where: { teamId: who.teamId }, data: { enabled: !!enabled, updatedById: who.id } });
  revalidatePath("/settings/email");
  return { success: true };
}

/** Forget the team's server (and its password, or its Google connection — which is revoked) */
export async function removeEmailServerAction(): Promise<Result> {
  const who = await headMentor();
  if (!who) return { success: false, error: "Only Head Mentors and Integration Admins can set up the team's email." };
  const existing = await prisma.teamEmailServer.findUnique({ where: { teamId: who.teamId }, select: { refreshTokenEnc: true } });
  const token = existing?.refreshTokenEnc ? open(existing.refreshTokenEnc) : null;
  if (token) await revokeGmail(token);
  await prisma.teamEmailServer.deleteMany({ where: { teamId: who.teamId } });
  revalidatePath("/settings/email");
  return { success: true };
}

const SenderSchema = z.object({
  fromName:  z.string().trim().max(100).optional(),
  fromEmail: z.string().trim().email("Enter the email address messages come from.").max(254),
});

/** Gmail / Workspace: the name and address messages come from (the mailbox, or a Send-mail-as alias) */
export async function saveGmailSenderAction(input: unknown): Promise<Result> {
  const who = await headMentor();
  if (!who) return { success: false, error: "Only Head Mentors and Integration Admins can set up the team's email." };
  const parsed = SenderSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: issueMessage(parsed.error) };
  const { count } = await prisma.teamEmailServer.updateMany({
    where: { teamId: who.teamId, method: { in: ["gmail_api", "google_sa"] } },
    data:  { fromName: parsed.data.fromName || null, fromEmail: parsed.data.fromEmail.toLowerCase(), updatedById: who.id },
  });
  if (count === 0) return { success: false, error: "Connect Gmail first." };
  revalidatePath("/settings/email");
  return { success: true };
}

const ServiceAccountSchema = z.object({
  /** The key file's JSON, or base64 of it. Blank keeps the saved key. */
  key:       z.string().max(20_000).optional(),
  sender:    z.string().trim().email("Enter the Workspace mailbox to send as.").max(254),
  fromName:  z.string().trim().max(100).optional(),
  /** Blank: the mailbox itself */
  fromEmail: z.string().trim().max(254).optional(),
});

/**
 * Google Workspace service account: check the key works for the mailbox (Google hands out a token —
 * nothing is sent), then save it encrypted. The app only ever sends as that one mailbox.
 */
export async function saveServiceAccountAction(input: unknown): Promise<Result> {
  const who = await headMentor();
  if (!who) return { success: false, error: "Only Head Mentors and Integration Admins can set up the team's email." };
  const parsed = ServiceAccountSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: issueMessage(parsed.error) };
  const d = parsed.data;
  const fromEmail = (d.fromEmail || d.sender).toLowerCase();
  if (!z.string().email().safeParse(fromEmail).success) return { success: false, error: "Enter a valid From email." };

  const existing = await prisma.teamEmailServer.findUnique({ where: { teamId: who.teamId } });
  const keyText = d.key?.trim() ? d.key.trim() : existing?.serviceKeyEnc ? open(existing.serviceKeyEnc) : null;
  if (!keyText) return { success: false, error: existing?.serviceKeyEnc ? "Upload the key again — the saved one can't be read." : "Upload the service account's key file." };

  let key;
  try {
    key = parseServiceAccountKey(keyText);
    await serviceAccountToken(key, d.sender.toLowerCase());
  } catch (e) {
    return { success: false, error: e instanceof GmailError ? e.message : "Couldn't check the service account with Google." };
  }

  // Switching from Connect with Google: that access is no longer needed
  if (existing?.refreshTokenEnc) {
    const old = open(existing.refreshTokenEnc);
    if (old) await revokeGmail(old);
  }
  const data = {
    provider: "google_sa", method: "google_sa",
    host: null, port: null, security: null, username: null, passwordEnc: null, refreshTokenEnc: null,
    // Stored as normalized JSON, encrypted
    serviceKeyEnc: seal(JSON.stringify(key)), serviceAccountEmail: key.client_email,
    googleEmail: d.sender.toLowerCase(), fromName: d.fromName || null, fromEmail,
    enabled: true, lastError: null, lastErrorAt: null, updatedById: who.id,
  };
  await prisma.teamEmailServer.upsert({ where: { teamId: who.teamId }, create: { teamId: who.teamId, ...data }, update: data });
  revalidatePath("/settings/email");
  return { success: true };
}

/** Spam guard: the most team emails an hour and a day */
export async function saveMailLimitsAction(input: { hourly: number; daily: number }): Promise<Result> {
  plainObject(input);
  const who = await headMentor();
  if (!who) return { success: false, error: "Only Head Mentors and Integration Admins can change the team's email limits." };
  const hourly = Math.round(Number(input.hourly));
  const daily = Math.round(Number(input.daily));
  if (!(hourly >= 1 && hourly <= MAX_HOURLY_LIMIT)) return { success: false, error: `The hourly limit can be 1–${MAX_HOURLY_LIMIT}.` };
  if (!(daily >= 1 && daily <= MAX_DAILY_LIMIT)) return { success: false, error: `The daily limit can be 1–${MAX_DAILY_LIMIT}.` };
  if (hourly > daily) return { success: false, error: "The hourly limit can't be more than the daily one." };
  const { count } = await prisma.teamEmailServer.updateMany({ where: { teamId: who.teamId }, data: { hourlyLimit: hourly, dailyLimit: daily, updatedById: who.id } });
  if (count === 0) return { success: false, error: "Set up the team's email first." };
  revalidatePath("/settings/email");
  return { success: true };
}
