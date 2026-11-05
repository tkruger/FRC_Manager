// Spam guard: every team email — whichever way it's sent (the team's Google account, service
// account, mail server, or FRC Manager's own email) — counts against the team's hourly and daily
// limits. Past either, nothing more goes out until the window resets, and the team's Head Mentors and
// Integration Admins hear about it once. If the count can't be checked, nothing is sent (fails
// closed — unlike sign-in limits, which fail open). Server-only.

import { prisma } from "@/lib/prisma";
import { claimOnce } from "@/lib/notify/claim";

export const DEFAULT_HOURLY_LIMIT = 250;
export const DEFAULT_DAILY_LIMIT = 1000;
/** The most a team can raise them to (Google Workspace sends about 2,000 a day per mailbox) */
export const MAX_HOURLY_LIMIT = 1000;
export const MAX_DAILY_LIMIT = 2000;

const HOUR = 3600, DAY = 86_400;
const hourKey = (teamId: string) => `teammail:h:${teamId}`;
const dayKey = (teamId: string) => `teammail:d:${teamId}`;

async function count(key: string, windowSeconds: number): Promise<number> {
  const [row] = await prisma.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimit" ("key", "count", "resetAt")
    VALUES (${key}, 1, now() + make_interval(secs => ${windowSeconds}))
    ON CONFLICT ("key") DO UPDATE SET
      "count"   = CASE WHEN "RateLimit"."resetAt" < now() THEN 1 ELSE "RateLimit"."count" + 1 END,
      "resetAt" = CASE WHEN "RateLimit"."resetAt" < now() THEN now() + make_interval(secs => ${windowSeconds}) ELSE "RateLimit"."resetAt" END
    RETURNING "count"`;
  return Number(row?.count ?? Infinity);
}

/** Count one team email. ok: false (with a reason) when it's over a limit — then don't send it. */
export async function countTeamMail(teamId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const limits = await prisma.teamEmailServer.findUnique({ where: { teamId }, select: { hourlyLimit: true, dailyLimit: true } });
    const hourly = limits?.hourlyLimit ?? DEFAULT_HOURLY_LIMIT;
    const daily = limits?.dailyLimit ?? DEFAULT_DAILY_LIMIT;
    const [h, d] = await Promise.all([count(hourKey(teamId), HOUR), count(dayKey(teamId), DAY)]);
    if (h <= hourly && d <= daily) return { ok: true };
    const which = d > daily ? `${daily} a day` : `${hourly} an hour`;
    await warnAdmins(teamId, which, d > daily ? "d" : "h");
    return { ok: false, error: `The team's email limit (${which}) was reached, so this wasn't sent.` };
  } catch (e) {
    console.error("[mail-limits] couldn't check — not sending:", e);
    return { ok: false, error: "Couldn't check the team's email limit, so this wasn't sent." };
  }
}

/** Tell the team's email admins once per window */
async function warnAdmins(teamId: string, which: string, window: "h" | "d") {
  const row = await prisma.rateLimit.findUnique({ where: { key: window === "d" ? dayKey(teamId) : hourKey(teamId) }, select: { resetAt: true } });
  if (!(await claimOnce(`mailcap:${teamId}:${window}:${row?.resetAt.toISOString() ?? ""}`))) return;
  // Imported here so sending email never loads the notification code until it's needed
  const { notifyRoles } = await import("@/lib/notify/deliver");
  await notifyRoles(teamId, ["HEAD_MENTOR", "INTEGRATION_ADMIN"], {
    topic: "team.email_limit",
    type:  "CRITICAL_ISSUE",
    title: "✋ The team's email limit was reached",
    body:  `More than ${which} team emails were sent, so the rest are held back until ${row ? row.resetAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "the limit resets"}. If that wasn't expected, check Settings → Integrations → Team email.`,
    url:   "/settings/email",
  }).catch((e) => console.error("[mail-limits] warn", e));
}

/** How much of the limits has been used (for the settings page) */
export async function teamMailUsage(teamId: string) {
  const rows = await prisma.rateLimit.findMany({ where: { key: { in: [hourKey(teamId), dayKey(teamId)] } }, select: { key: true, count: true, resetAt: true } });
  const now = Date.now();
  const get = (k: string) => {
    const r = rows.find((x) => x.key === k);
    return r && r.resetAt.getTime() > now ? { used: r.count, resetsAt: r.resetAt.toISOString() } : { used: 0, resetsAt: null };
  };
  return { hour: get(hourKey(teamId)), day: get(dayKey(teamId)) };
}
