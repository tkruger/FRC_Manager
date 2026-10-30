"use server";

// A team's own mail server (Settings → Email, Head Mentors only). Team emails go out through
// it; account emails, and anything it fails to send, use the app's service.

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { issueMessage } from "@/lib/validation";
import { seal, open } from "@/lib/security/secret-box";
import { sendViaMailServer, verifyMailServer, type MailServer } from "@/lib/team-mail";
import { MAIL_PORTS, PROVIDER_BY_ID, type MailSecurity } from "@/lib/email-providers";
import { escapeHtml } from "@/lib/html";

type Result = { success: true } | { success: false; error: string };

async function headMentor() {
  const session = await auth();
  if (!session?.user?.id || !session.user.teamId) return null;
  if (!session.user.roles.includes("HEAD_MENTOR")) return null;
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
  if (!who) return { success: false, error: "Only Head Mentors can set up the team's email." };
  const parsed = Schema.safeParse(input);
  if (!parsed.success) return { success: false, error: issueMessage(parsed.error) };
  const d = parsed.data;

  const existing = await prisma.teamEmailServer.findUnique({ where: { teamId: who.teamId } });
  const password = d.password?.trim() ? d.password.trim() : existing ? open(existing.passwordEnc) : null;
  if (!password) return { success: false, error: existing ? "Enter the password again — the saved one can't be read." : "Enter the password." };

  const server: MailServer = {
    host: d.host.toLowerCase(), port: d.port, security: d.security as MailSecurity,
    username: d.username, password, fromName: d.fromName || null, fromEmail: d.fromEmail.toLowerCase(),
  };
  const check = await verifyMailServer(server);
  if (!check.ok) return { success: false, error: check.error };

  const data = {
    provider: d.provider, host: server.host, port: server.port, security: server.security,
    username: server.username, passwordEnc: seal(password), fromName: server.fromName, fromEmail: server.fromEmail,
    enabled: true, lastError: null, lastErrorAt: null, updatedById: who.id,
  };
  await prisma.teamEmailServer.upsert({ where: { teamId: who.teamId }, create: { teamId: who.teamId, ...data }, update: data });
  revalidatePath("/settings/email");
  return { success: true };
}

/** Send a test message to yourself through the team's server (no fallback, so problems show) */
export async function sendTestEmailAction(): Promise<Result & { to?: string }> {
  const who = await headMentor();
  if (!who) return { success: false, error: "Only Head Mentors can set up the team's email." };
  const [server, me, team] = await Promise.all([
    prisma.teamEmailServer.findUnique({ where: { teamId: who.teamId } }),
    prisma.user.findUnique({ where: { id: who.id }, select: { email: true, name: true } }),
    prisma.team.findUnique({ where: { id: who.teamId }, select: { teamNumber: true } }),
  ]);
  if (!server) return { success: false, error: "Set up the mail server first." };
  if (!me || me.email.endsWith(".invalid")) return { success: false, error: "Your account has no email address to send the test to." };
  const password = open(server.passwordEnc);
  if (!password) return { success: false, error: "The saved password can't be read anymore — enter it again and save." };

  const line = `This is a test from FRC Manager. Team ${team?.teamNumber ?? ""} emails — notifications, invites and welcomes — will come from ${server.fromEmail}.`;
  const res = await sendViaMailServer({ ...server, security: server.security as MailSecurity, password }, {
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

/** Pause (back to the app's email) or resume the team's server */
export async function setEmailServerEnabledAction(enabled: boolean): Promise<Result> {
  const who = await headMentor();
  if (!who) return { success: false, error: "Only Head Mentors can set up the team's email." };
  await prisma.teamEmailServer.updateMany({ where: { teamId: who.teamId }, data: { enabled: !!enabled, updatedById: who.id } });
  revalidatePath("/settings/email");
  return { success: true };
}

/** Forget the team's server (and its password) */
export async function removeEmailServerAction(): Promise<Result> {
  const who = await headMentor();
  if (!who) return { success: false, error: "Only Head Mentors can set up the team's email." };
  await prisma.teamEmailServer.deleteMany({ where: { teamId: who.teamId } });
  revalidatePath("/settings/email");
  return { success: true };
}
