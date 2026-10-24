// Which season is active — worked out from today's date, never picked by hand. Server-only.
//
// - The season today falls in (in the team's time zone) is active.
// - Between seasons, the one that started most recently stays active, so the app still
//   shows its tasks, budget and robots until the next season starts.
// - A team with only future seasons gets the earliest one, so it can be set up ahead.
// Runs after seasons are created or changed, and hourly (the reminders cron), so a new
// season becomes active by itself on its start date.

import { prisma } from "@/lib/prisma";
import { FALLBACK_TIMEZONE, calendarDayKey, isValidTimezone, localParts } from "@/lib/notify/time";

/** The season that should be active, from a team's seasons and today's date ("YYYY-MM-DD") */
export function pickActiveSeason<T extends { id: string; startDate: Date; endDate: Date }>(seasons: T[], todayKey: string): T | null {
  const span = (s: T) => ({ s, start: calendarDayKey(s.startDate), end: calendarDayKey(s.endDate) });
  const all = seasons.map(span);
  const current = all.filter((x) => x.start <= todayKey && todayKey <= x.end).sort((a, b) => b.start.localeCompare(a.start))[0];
  if (current) return current.s;
  const started = all.filter((x) => x.start <= todayKey).sort((a, b) => b.start.localeCompare(a.start))[0];
  if (started) return started.s;
  return all.sort((a, b) => a.start.localeCompare(b.start))[0]?.s ?? null;
}

/** Make the right season active for one team. Returns the active season's id (or null). */
export async function syncActiveSeason(teamId: string): Promise<string | null> {
  const [team, seasons] = await Promise.all([
    prisma.team.findUnique({ where: { id: teamId }, select: { timezone: true } }),
    prisma.season.findMany({ where: { teamId }, select: { id: true, startDate: true, endDate: true, isActive: true } }),
  ]);
  const tz = isValidTimezone(team?.timezone) ? team!.timezone! : FALLBACK_TIMEZONE;
  const want = pickActiveSeason(seasons, localParts(new Date(), tz).dateKey);
  const wrong = seasons.filter((s) => s.isActive !== (s.id === want?.id));
  if (wrong.length) {
    await prisma.$transaction([
      prisma.season.updateMany({ where: { teamId, isActive: true, ...(want ? { id: { not: want.id } } : {}) }, data: { isActive: false } }),
      ...(want ? [prisma.season.update({ where: { id: want.id }, data: { isActive: true } })] : []),
    ]);
  }
  return want?.id ?? null;
}

/** For the hourly job: every team. Returns how many teams' active season changed. */
export async function syncAllActiveSeasons(): Promise<number> {
  const teams = await prisma.season.findMany({ distinct: ["teamId"], select: { teamId: true } });
  let changed = 0;
  for (const { teamId } of teams) {
    const before = await prisma.season.findFirst({ where: { teamId, isActive: true }, select: { id: true } });
    const after = await syncActiveSeason(teamId);
    if ((before?.id ?? null) !== after) changed++;
  }
  return changed;
}
