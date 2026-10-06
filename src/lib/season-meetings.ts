// Keeping a season's meetings in step with its dates and meeting schedule. Server-only.
//
// Only meetings that haven't started yet are ever changed — including ones later today.
// Past meetings (and one already under way) stay exactly as they happened.
//
// Meeting dates are calendar days (read with calendarDayKey, so it doesn't matter which
// time zone the server runs in) and their times are wall-clock times in the team's zone.

import { prisma } from "@/lib/prisma";
import { FALLBACK_TIMEZONE, calendarDayKey, isValidTimezone, localParts, zonedTimeToUtc } from "@/lib/notify/time";

const DAY_KEYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

/** A season's meeting schedule: which days, and each day's times */
export interface MeetingSchedule {
  meetingDays:      string[];
  meetingStartTime: string;
  meetingEndTime:   string;
  meetingDayTimes:  unknown;
}

/** A day's meeting times under a schedule, or null when it isn't a meeting day */
function timesFor(schedule: MeetingSchedule, day: string): { start: string; end: string } | null {
  if (!schedule.meetingDays.includes(day)) return null;
  const perDay = (schedule.meetingDayTimes as Record<string, { start: string; end: string }> | null) ?? {};
  return perDay[day] ?? { start: schedule.meetingStartTime, end: schedule.meetingEndTime };
}

/** "2026-10-07" → "WED" */
function weekday(dayKey: string): string {
  return DAY_KEYS[new Date(`${dayKey}T00:00:00Z`).getUTCDay()];
}

function nextDay(dayKey: string): string {
  const d = new Date(`${dayKey}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** When a meeting on `dayKey` at "HH:MM" starts, as an instant */
function startsAt(dayKey: string, time: string, tz: string): Date {
  const [y, mo, d] = dayKey.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  return zonedTimeToUtc(y, mo, d, h || 0, mi || 0, tz);
}

async function teamTimezone(seasonId: string): Promise<string> {
  const s = await prisma.season.findUnique({ where: { id: seasonId }, select: { team: { select: { timezone: true } } } });
  return isValidTimezone(s?.team.timezone) ? s!.team.timezone! : FALLBACK_TIMEZONE;
}

/** A season's start date can't move once the season has started. */
export function seasonStarted(kickoffDate: Date, tz = FALLBACK_TIMEZONE): boolean {
  return calendarDayKey(kickoffDate) < localParts(new Date(), tz).dateKey;
}

/** Meetings that haven't started yet (later today included) */
async function upcomingMeetings(seasonId: string, tz: string, onlyRegular: boolean) {
  const now = new Date();
  const todayKey = localParts(now, tz).dateKey;
  // A day's margin either side of the zone boundary; filtered precisely below
  const from = new Date(`${todayKey}T00:00:00Z`);
  from.setUTCDate(from.getUTCDate() - 1);
  const rows = await prisma.meeting.findMany({
    where:  { seasonId, date: { gte: from }, ...(onlyRegular ? { customTime: false } : {}) },
    select: { id: true, date: true, startTime: true, endTime: true, title: true, notes: true, cancelled: true, _count: { select: { tasks: true } } },
  });
  return rows
    .map((m) => ({ ...m, day: calendarDayKey(m.date) }))
    .filter((m) => m.day > todayKey || (m.day === todayKey && startsAt(m.day, m.startTime, tz) > now));
}

/**
 * Bring meetings that haven't started yet in line with the season's dates and schedule:
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

  const tz       = await teamTimezone(seasonId);
  const now      = new Date();
  const todayKey = localParts(now, tz).dateKey;
  const startKey = calendarDayKey(season.kickoffDate);
  const endKey   = calendarDayKey(season.endDate);

  let removed = 0;
  let moved = 0;

  // Outside the season's dates (any meeting that hasn't started, hand-set or not)
  const outside = (await upcomingMeetings(seasonId, tz, false)).filter((m) => m.day < startKey || m.day > endKey);
  if (outside.length) {
    removed += (await prisma.meeting.deleteMany({ where: { id: { in: outside.map((m) => m.id) } } })).count;
  }

  // Regular meetings follow the schedule
  for (const m of await upcomingMeetings(seasonId, tz, true)) {
    if (m.day < startKey || m.day > endKey) continue;
    const times = timesFor(season, weekday(m.day));
    if (!times) {
      const inUse = m.title || m.notes || m.cancelled || m._count.tasks > 0;
      if (!inUse) { await prisma.meeting.delete({ where: { id: m.id } }); removed++; }
    } else if (m.startTime !== times.start || m.endTime !== times.end) {
      await prisma.meeting.update({ where: { id: m.id }, data: { startTime: times.start, endTime: times.end } });
      moved++;
    }
  }

  // Meeting days that don't have a meeting yet (today only if its time is still ahead)
  const firstKey = startKey > todayKey ? startKey : todayKey;
  const marginStart = new Date(`${firstKey}T00:00:00Z`);
  marginStart.setUTCDate(marginStart.getUTCDate() - 1);
  const taken = new Set(
    (await prisma.meeting.findMany({ where: { seasonId, date: { gte: marginStart } }, select: { date: true } }))
      .map((m) => calendarDayKey(m.date)),
  );
  const meetings: { seasonId: string; date: Date; startTime: string; endTime: string }[] = [];
  for (let key = firstKey; key <= endKey; key = nextDay(key)) {
    const times = timesFor(season, weekday(key));
    if (!times || taken.has(key)) continue;
    if (key === todayKey && startsAt(key, times.start, tz) <= now) continue;
    meetings.push({ seasonId, date: new Date(`${key}T00:00:00Z`), startTime: times.start, endTime: times.end });
  }
  if (meetings.length) await prisma.meeting.createMany({ data: meetings });

  return { added: meetings.length, removed, moved };
}

/**
 * "Regenerate": rebuild the regular meetings from now to the season end, replacing every
 * meeting that hasn't started yet. Past meetings (and one under way) are kept.
 */
export async function regenerateFutureMeetings(seasonId: string): Promise<number> {
  const tz = await teamTimezone(seasonId);
  const upcoming = await upcomingMeetings(seasonId, tz, false);
  if (upcoming.length) await prisma.meeting.deleteMany({ where: { id: { in: upcoming.map((m) => m.id) } } });
  return (await syncSeasonMeetings(seasonId)).added;
}
