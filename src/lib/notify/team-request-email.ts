// The "are you the Head Mentor?" email for a team that's new to FRC Manager. Server-only.
// Sent to the person who registered the team when they sign up (unless super admins turned
// that off), with every super admin on CC (replies go to the super admins too), and again
// whenever a super admin presses Send / Resend on Team approvals. Super admins edit the
// subject and text there; this file holds the defaults. Best-effort: a failure is logged and
// never stops the registration.

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendEmail, escapeHtml } from "@/lib/email";

const SETTING_KEY = "teamRequestEmail";

export type TeamRequestEmailSettings = { subject: string; body: string; autoSend: boolean };

/** Placeholders the subject and text can use */
export const TEAM_REQUEST_PLACEHOLDERS = [
  { key: "{team}",      help: "the team number" },
  { key: "{name}",      help: "the applicant's full name" },
  { key: "{firstName}", help: "the applicant's first name" },
] as const;

export const DEFAULT_TEAM_REQUEST_EMAIL: TeamRequestEmailSettings = {
  subject: "FRC Manager request for team {team}",
  body: [
    "I saw a request for an account on frcmanager.com - To grant it I need a head mentor to be the first person that applies so I can approve that role first. Please let me know if either 1. you are the head mentor or 2. who I should be looking for from a name perspective?",
    "Ps. If you are looking for the game from Chief Delphi this is not it.",
    "Thank you!",
    "~\nFRC Manager Server Admin\nTeam 8738 SLICE",
  ].join("\n\n"),
  autoSend: true,
};

export const TeamRequestEmailSchema = z.object({
  subject:  z.string().trim().min(1, "Add a subject").max(200, "Keep the subject under 200 characters"),
  body:     z.string().trim().min(1, "Add the email's text").max(5000, "Keep the text under 5,000 characters"),
  autoSend: z.boolean(),
});

export async function getTeamRequestEmailSettings(): Promise<TeamRequestEmailSettings> {
  const row = await prisma.platformSetting.findUnique({ where: { key: SETTING_KEY } });
  const parsed = TeamRequestEmailSchema.safeParse(row?.value);
  return parsed.success ? parsed.data : DEFAULT_TEAM_REQUEST_EMAIL;
}

export async function saveTeamRequestEmailSettings(settings: TeamRequestEmailSettings, userId: string): Promise<void> {
  await prisma.platformSetting.upsert({
    where:  { key: SETTING_KEY },
    create: { key: SETTING_KEY, value: settings, updatedById: userId },
    update: { value: settings, updatedById: userId },
  });
}

type Vars = { team: string; name: string; firstName: string };

function fill(template: string, v: Vars): string {
  return template.replace(/\{(team|name|firstName)\}/g, (_, k: keyof Vars) => v[k]);
}

/** The email, filled in: plain text as written, and the same as simple HTML paragraphs */
export function renderTeamRequestEmail(t: Pick<TeamRequestEmailSettings, "subject" | "body">, v: Vars) {
  const text = fill(t.body, v).replace(/\r\n/g, "\n");
  const paragraphs = text.split(/\n{2,}/).map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`);
  return {
    subject: fill(t.subject, v).replace(/\s+/g, " ").trim(),
    text,
    html: `<div style="font-family:system-ui,sans-serif;max-width:560px;line-height:1.5;color:#1f2430">\n${paragraphs.join("\n")}\n</div>`,
  };
}

/** Super admins to copy in (and take replies), minus anyone excluded */
async function superAdminEmails(exclude: string[] = []): Promise<string[]> {
  const admins = await prisma.user.findMany({ where: { isSuperAdmin: true, status: "ACTIVE" }, select: { email: true } });
  const skip = new Set(exclude.map((e) => e.toLowerCase()));
  return [...new Set(admins.map((a) => a.email.toLowerCase()))].filter((e) => !e.endsWith(".invalid") && !skip.has(e));
}

/**
 * Email the person who registered a waiting team. `auto`: sent because they just registered,
 * which super admins can turn off (a Send / Resend from Team approvals always goes).
 */
export async function sendTeamRequestEmail(teamId: string, opts: { auto?: boolean } = {}): Promise<{ sent: boolean; error?: string; to?: string; cc?: number }> {
  try {
    const settings = await getTeamRequestEmailSettings();
    if (opts.auto && !settings.autoSend) return { sent: false, error: "Sending on registration is turned off." };

    const team = await prisma.team.findUnique({
      where:  { id: teamId },
      select: { teamNumber: true, status: true, users: { where: { status: "PENDING" }, orderBy: { createdAt: "asc" }, take: 1, select: { email: true, name: true } } },
    });
    if (!team) return { sent: false, error: "Team not found." };
    if (team.status !== "PENDING") return { sent: false, error: "This team has already been reviewed." };
    const founder = team.users[0];
    if (!founder || founder.email.endsWith(".invalid")) return { sent: false, error: "No one is waiting on this team to email." };

    const cc = await superAdminEmails([founder.email]);
    const mail = renderTeamRequestEmail(settings, { team: String(team.teamNumber), name: founder.name, firstName: founder.name.split(" ")[0] || founder.name });
    const res = await sendEmail({ to: founder.email, cc, ...mail });
    if (!res.sent) {
      console.warn(`[email] Head Mentor check for team ${team.teamNumber} not sent: ${res.error}`);
      return { sent: false, error: res.error };
    }
    await prisma.team.update({ where: { id: teamId }, data: { headMentorCheckSentAt: new Date(), headMentorCheckSentCount: { increment: 1 } } });
    return { sent: true, to: founder.email, cc: cc.length };
  } catch (e) {
    console.error("[email] Head Mentor check email failed:", e);
    return { sent: false, error: "The email couldn't be sent." };
  }
}

/** A test of the (unsaved) email to one super admin only, filled in with example details */
export async function sendTeamRequestTestEmail(t: Pick<TeamRequestEmailSettings, "subject" | "body">, to: string): Promise<{ sent: boolean; error?: string }> {
  const mail = renderTeamRequestEmail(t, { team: "9999", name: "Alex Johnson", firstName: "Alex" });
  return sendEmail({ to, ...mail, subject: `[Test] ${mail.subject}` });
}
