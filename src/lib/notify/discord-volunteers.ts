// Each morning: the parent Discord server's Volunteers channel hears which of the next two
// weeks' meetings still need adults. Once a day per team (ReminderLog), skipped when every
// meeting is covered. Run by the hourly job. Server-only.

import { prisma } from "@/lib/prisma";
import { notifyVolunteersNeeded } from "@/lib/discord-notify";
import { coverage, DEFAULT_MIN_ADULTS, shiftWhen } from "@/lib/volunteers";
import { DAILY_DIGEST_HOUR, FALLBACK_TIMEZONE, isValidTimezone, localParts } from "./time";

const DAYS_AHEAD = 14;
const MAX_LINES = 8;

export async function postVolunteerDigests(now = new Date()): Promise<number> {
  const configs = await prisma.discordConfig.findMany({
    where:  { audience: "PARENT", active: true, channelVolunteers: { not: null } },
    select: { teamId: true, team: { select: { timezone: true, volunteerSettings: { select: { minAdults: true } } } } },
  });

  let posted = 0;
  for (const c of configs) {
    const tz = isValidTimezone(c.team.timezone) ? c.team.timezone : FALLBACK_TIMEZONE;
    const local = localParts(now, tz);
    if (local.hour < DAILY_DIGEST_HOUR) continue;
    const key = `discord-volunteers:${c.teamId}:${local.dateKey}`;
    if (await prisma.reminderLog.findUnique({ where: { key } })) continue;

    const from = new Date(`${local.dateKey}T00:00:00Z`);
    const meetings = await prisma.meeting.findMany({
      where:   { season: { teamId: c.teamId, isActive: true }, cancelled: false, date: { gte: from, lt: new Date(from.getTime() + DAYS_AHEAD * 86_400_000) } },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
      select:  { date: true, startTime: true, endTime: true, title: true, volunteers: { select: { status: true } } },
    });
    const min = c.team.volunteerSettings?.minAdults ?? DEFAULT_MIN_ADULTS;
    const short = meetings.map((m) => ({ m, cov: coverage(m.volunteers, min) })).filter(({ cov }) => !cov.covered);

    // Recorded either way, so a covered day isn't checked again every hour
    await prisma.reminderLog.upsert({ where: { key }, create: { key, lastSentAt: now }, update: { lastSentAt: now } });
    if (short.length === 0) continue;

    const lines = short.slice(0, MAX_LINES).map(({ m, cov }) =>
      `• **${shiftWhen(m)}**${m.title ? ` — ${m.title}` : ""}: needs ${cov.needed} more${cov.pending ? ` (${cov.pending} asked)` : ""}`);
    if (short.length > MAX_LINES) lines.push(`…and ${short.length - MAX_LINES} more`);
    if (await notifyVolunteersNeeded(c.teamId, `🙋 ${short.length} meeting${short.length === 1 ? "" : "s"} need adult volunteers`, lines)) posted++;
  }
  return posted;
}
