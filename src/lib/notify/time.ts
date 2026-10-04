// Time-zone helpers built on Intl (no tz library needed).

export const FALLBACK_TIMEZONE = process.env.DEFAULT_TIMEZONE || "America/New_York";

export function isValidTimezone(tz: string | null | undefined): tz is string {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export interface LocalParts {
  year: number; month: number; day: number; hour: number; minute: number;
  /** YYYY-MM-DD in the zone — handy as a "once per local day" key */
  dateKey: string;
}

export function localParts(at: Date, tz: string): LocalParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const year = get("year"), month = get("month"), day = get("day");
  return {
    year, month, day, hour: get("hour"), minute: get("minute"),
    dateKey: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
  };
}

/** The UTC instant at which the wall-clock time y-m-d h:mi occurs in `tz`. */
export function zonedTimeToUtc(year: number, month: number, day: number, hour: number, minute: number, tz: string): Date {
  const wallAsUtc = Date.UTC(year, month - 1, day, hour, minute);
  // Two passes handle DST transitions correctly
  let guess = wallAsUtc;
  for (let i = 0; i < 2; i++) {
    const p = localParts(new Date(guess), tz);
    const shownAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
    guess += wallAsUtc - shownAsUtc;
  }
  return new Date(guess);
}

/**
 * Dates stored as "a calendar day" (meetings, due dates, competitions) are saved
 * at UTC midnight. Read their calendar day back without shifting zones.
 */
export function calendarDayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Whole days from local `todayKey` to `dayKey` (both YYYY-MM-DD). */
export function daysUntil(todayKey: string, dayKey: string): number {
  return Math.round((Date.parse(dayKey) - Date.parse(todayKey)) / 86_400_000);
}

export function inQuietHours(localHour: number, start: number, end: number): boolean {
  if (start === end) return false;
  return start < end
    ? localHour >= start && localHour < end
    : localHour >= start || localHour < end; // wraps midnight, e.g. 21 → 7
}

/** Hour of the day daily digests go out (local time). */
export const DAILY_DIGEST_HOUR = 8;
