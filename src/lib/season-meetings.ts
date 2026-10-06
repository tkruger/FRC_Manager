// Keeping a season's meetings in step with its dates. Server-only.

import { prisma } from "@/lib/prisma";

const DAY_NUMBERS: Record<string, number> = { SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6 };

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** A season's start date can't move once the season has started. */
export function seasonStarted(kickoffDate: Date): boolean {
  return kickoffDate < startOfToday();
}

/**
 * After the season's start or end date changes: from today on, drop meetings that now
 * fall outside the season and add meetings on the meeting days that aren't covered yet.
 * Past meetings, and meetings already on the calendar (edited, canceled or added by
 * hand), are left as they are.
 */
export async function syncSeasonMeetings(seasonId: string): Promise<{ added: number; removed: number }> {
  const season = await prisma.season.findUnique({ where: { id: seasonId } });
  if (!season) return { added: 0, removed: 0 };

  const today = startOfToday();
  const start = new Date(season.kickoffDate); start.setHours(0, 0, 0, 0);
  const end   = new Date(season.endDate);     end.setHours(23, 59, 59, 999);

  const { count: removed } = await prisma.meeting.deleteMany({
    where: { seasonId, date: { gte: today }, OR: [{ date: { lt: start } }, { date: { gt: end } }] },
  });

  const from = start > today ? start : today;
  const taken = new Set(
    (await prisma.meeting.findMany({ where: { seasonId, date: { gte: from, lte: end } }, select: { date: true } }))
      .map((m) => dayKey(m.date)),
  );

  const dayTimes = (season.meetingDayTimes as Record<string, { start: string; end: string }> | null) ?? {};
  const days = new Map(season.meetingDays.map((d) => [DAY_NUMBERS[d], d]));

  const meetings: { seasonId: string; date: Date; startTime: string; endTime: string }[] = [];
  for (const cursor = new Date(from); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    const day = days.get(cursor.getDay());
    if (!day || taken.has(dayKey(cursor))) continue;
    const times = dayTimes[day] ?? { start: season.meetingStartTime, end: season.meetingEndTime };
    meetings.push({ seasonId, date: new Date(cursor), startTime: times.start, endTime: times.end });
  }
  if (meetings.length) await prisma.meeting.createMany({ data: meetings });

  return { added: meetings.length, removed };
}
