// A season's weekly meeting schedule: which days, and the meeting time slots on each.
// Client-safe. A day can have several meetings (e.g. 3–5 pm and 6–8 pm).
//
// Stored in Season.meetingDayTimes as { MON: [{ start, end }, …], … }. Older seasons stored
// one { start, end } per day — read here as a one-slot list.

export type Slot = { start: string; end: string };

export const WEEK_DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const;

export interface ScheduleSource {
  meetingDays:      string[];
  meetingStartTime: string;
  meetingEndTime:   string;
  meetingDayTimes:  unknown;
}

const isSlot = (v: unknown): v is Slot =>
  !!v && typeof v === "object" && typeof (v as Slot).start === "string" && typeof (v as Slot).end === "string";

/** A day's meeting slots, earliest first (empty when it isn't a meeting day) */
export function daySlots(schedule: ScheduleSource, day: string): Slot[] {
  if (!schedule.meetingDays.includes(day)) return [];
  const stored = (schedule.meetingDayTimes as Record<string, unknown> | null)?.[day];
  const slots = Array.isArray(stored) ? stored.filter(isSlot) : isSlot(stored) ? [stored] : [];
  const list = slots.length ? slots : [{ start: schedule.meetingStartTime, end: schedule.meetingEndTime }];
  return [...list].sort((a, b) => a.start.localeCompare(b.start));
}

/** Every meeting day's slots */
export function scheduleSlots(schedule: ScheduleSource): Record<string, Slot[]> {
  return Object.fromEntries(WEEK_DAYS.filter((d) => schedule.meetingDays.includes(d)).map((d) => [d, daySlots(schedule, d)]));
}

/** "HH:MM" → minutes after midnight */
export const minutesOf = (t: string) => { const [h, m] = t.split(":").map(Number); return (h || 0) * 60 + (m || 0); };
