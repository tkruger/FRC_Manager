// Sending email. Server-only.
//
// Team emails (notifications, invites, welcomes — callers pass the team) go through the
// team's own mail server when it has one (Settings → Email); if that fails, or for account
// emails (verification, password reset — no team passed), the app's service sends it:
//
//   RESEND_API_KEY  the API key (Resend — https://resend.com); without it nothing is sent
//                   (callers fall back to showing links)
//   EMAIL_FROM      the sender, e.g. "FRC Manager <invites@frcmanager.com>" — the domain must be
//                   verified in Resend. Until then Resend's test sender only reaches your own address.

import { prisma } from "@/lib/prisma";
import { open } from "@/lib/security/secret-box";
import { sendViaMailServer } from "@/lib/team-mail";
import type { MailSecurity } from "@/lib/email-providers";

export function emailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

type Mail = { to: string; subject: string; html: string; text: string };

/**
 * Send an email. Pass `teamId` for team emails: they go through the team's mail server first.
 * Leave it out for account emails, which always use the app's service.
 */
export async function sendEmail(msg: Mail, opts: { teamId?: string | null } = {}): Promise<{ sent: boolean; error?: string }> {
  if (opts.teamId) {
    const viaTeam = await sendViaTeam(opts.teamId, msg);
    if (viaTeam) return { sent: true };
  }
  return sendViaService(msg);
}

/** Through the team's own server; false when it has none (or it failed — the error is kept for Settings → Email) */
async function sendViaTeam(teamId: string, msg: Mail): Promise<boolean> {
  try {
    const server = await prisma.teamEmailServer.findUnique({ where: { teamId } });
    if (!server?.enabled) return false;
    const password = open(server.passwordEnc);
    if (!password) {
      await prisma.teamEmailServer.update({ where: { teamId }, data: { lastError: "The saved password can't be read anymore — enter it again.", lastErrorAt: new Date() } });
      return false;
    }
    const res = await sendViaMailServer({ ...server, security: server.security as MailSecurity, password }, msg);
    await prisma.teamEmailServer.update({
      where: { teamId },
      data:  res.sent ? { lastSentAt: new Date() } : { lastError: res.error, lastErrorAt: new Date() },
    });
    if (!res.sent) console.warn(`[email] Team mail server failed for team ${teamId}, using the app's instead: ${res.error}`);
    return res.sent;
  } catch (e) {
    console.error("[email] Team mail server:", e);
    return false;
  }
}

async function sendViaService(msg: Mail): Promise<{ sent: boolean; error?: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn("[email] RESEND_API_KEY isn't set in this deployment — nothing sent (redeploy after adding it)");
    return { sent: false, error: "Email isn't set up in this deployment (RESEND_API_KEY). If you just added it, redeploy." };
  }
  const from = process.env.EMAIL_FROM || "FRC Manager <onboarding@resend.dev>";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method:  "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body:    JSON.stringify({
        from,
        to:      [msg.to],
        subject: msg.subject,
        html:    msg.html,
        text:    msg.text,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { message?: string; name?: string };
      // Shows up in Vercel → Logs; the reason is also shown to whoever sent the invite
      // The recipient's domain only — no full addresses in the logs
      console.error(`[email] Resend refused (${res.status} ${body.name ?? ""}) sending from "${from}" to …@${msg.to.split("@")[1] ?? "?"}: ${body.message ?? "no message"}`);
      return { sent: false, error: body.message ?? `Resend error ${res.status}` };
    }
    return { sent: true };
  } catch (e) {
    console.error("[email] Couldn't reach Resend:", e);
    return { sent: false, error: e instanceof Error ? e.message : "Couldn't reach the email service." };
  }
}

export { escapeHtml } from "@/lib/html";
