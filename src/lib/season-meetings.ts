// Keeping a season's meetings in step with its dates and meeting schedule. Server-only.
//
// Only meetings from tomorrow on are ever changed. Past meetings (and today's, which may
// already be under way) stay exactly as they happened.

import { prisma } from "@/lib/prisma";

const DAY_NUMBERS: Record<string, number> = { SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6 };
const DAY_KEYS = Object.fromEntries(Object.entries(DAY_NUMBERS).map(([k, v]) => [v, k])) as Record<number, string>;

/** A season's meeting schedule: which days, and each day's times */
export interface MeetingSchedule {
  meetingDays:      string[];
  meetingStartTime: string;
  meetingEndTime:   string;
  meetingDayTimes:  unknown;
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** The first day meetings may be changed on: tomorrow */
function firstChangeableDay(): Date {
  const d = startOfToday();
  d.setDate(d.getDate() + 1);
  return d;
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** A day's meeting times under a schedule, or null when it isn't a meeting day */
function timesFor(schedule: MeetingSchedule, day: string): { start: string; end: string } | null {
  if (!schedule.meetingDays.includes(day)) return null;
  const perDay = (schedule.meetingDayTimes as Record<string, { start: string; end: string }> | null) ?? {};
  return perDay[day] ?? { start: schedule.meetingStartTime, end: schedule.meetingEndTime };
}

/** A season's start date can't move once the season has started. */
export function seasonStarted(kickoffDate: Date): boolean {
  return kickoffDate < startOfToday();
}

/**
 * Bring future meetings (from tomorrow on) in line with the season's dates and schedule:
 * - meetings outside the season's dates are removed
 * - regular meetings take their day's current times
 * - meetings on a day that's no longer a meeting day are removed, unless someone has
 *   added a title, notes or tasks to them, or canceled them
 * - meeting days without a meeting get one
 * Meetings whose time someone set by hand (customTime) are left alone.
 */
export async function syncSeasonMeetings(seasonId: string): Promise<{ added: number; removed: number; moved: number }> {
  const season = await prisma.season.findUnique({ where: { id: seasonId } });
  if (!season) return { added: 0, removed: 0, moved: 0 };

  const cutoff = firstChangeableDay();
  const start = new Date(season.kickoffDate); start.setHours(0, 0, 0, 0);
  const end   = new Date(season.endDate);     end.setHours(23, 59, 59, 999);

  let { count: removed } = await prisma.meeting.deleteMany({
    where: { seasonId, date: { gte: cutoff }, OR: [{ date: { lt: start } }, { date: { gt: end } }] },
  });

  let moved = 0;
  const future = await prisma.meeting.findMany({
    where:  { seasonId, date: { gte: cutoff }, customTime: false },
    select: { id: true, date: true, startTime: true, endTime: true, title: true, notes: true, cancelled: true, _count: { select: { tasks: true } } },
  });
  for (const m of future) {
    const times = timesFor(season, DAY_KEYS[m.date.getDay()]);
    if (!times) {
      const inUse = m.title || m.notes || m.cancelled || m._count.tasks > 0;
      if (!inUse) { await prisma.meeting.delete({ where: { id: m.id } }); removed++; }
    } else if (m.startTime !== times.start || m.endTime !== times.end) {
      await prisma.meeting.update({ where: { id: m.id }, data: { startTime: times.start, endTime: times.end } });
      moved++;
    }
  }

  const from = start > cutoff ? start : cutoff;
  const taken = new Set(
    (await prisma.meeting.findMany({ where: { seasonId, date: { gte: from, lte: end } }, select: { date: true } }))
      .map((m) => dayKey(m.date)),
  );

  const meetings: { seasonId: string; date: Date; startTime: string; endTime: string }[] = [];
  for (const cursor = new Date(from); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    const times = timesFor(season, DAY_KEYS[cursor.getDay()]);
    if (!times || taken.has(dayKey(cursor))) continue;
    meetings.push({ seasonId, date: new Date(cursor), startTime: times.start, endTime: times.end });
  }
  if (meetings.length) await prisma.meeting.createMany({ data: meetings });

  return { added: meetings.length, removed, moved };
}

/**
 * "Regenerate": rebuild the regular meetings from tomorrow to the season end, replacing
 * future meetings. Past meetings and today's are kept.
 */
export async function regenerateFutureMeetings(seasonId: string): Promise<number> {
  await prisma.meeting.deleteMany({ where: { seasonId, date: { gte: firstChangeableDay() } } });
  return (await syncSeasonMeetings(seasonId)).added;
}
