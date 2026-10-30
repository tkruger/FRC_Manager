// Volunteers: who can volunteer, who coordinates, and what a meeting needs.
// Safe to import on server and client.

/** Adults the clearance applies to (a Head Mentor can clear anyone, but these are listed) */
export const ADULT_ROLES = ["PARENT", "MENTOR", "HEAD_MENTOR", "VOLUNTEER_COORDINATOR"] as const;

/** Assign volunteers, set shift instructions, hear about meetings that are short */
export const COORDINATOR_ROLES = ["VOLUNTEER_COORDINATOR", "HEAD_MENTOR"] as const;

/** Confirmed adults a meeting needs when the team hasn't set a number */
export const DEFAULT_MIN_ADULTS = 2;

export function isAdult(roles: readonly string[]): boolean {
  return roles.some((r) => (ADULT_ROLES as readonly string[]).includes(r));
}

export function canCoordinate(roles: readonly string[]): boolean {
  return roles.some((r) => (COORDINATOR_ROLES as readonly string[]).includes(r));
}

/**
 * Cleared to volunteer: a Head Mentor marked them, and it hasn't run out. `until` is a
 * calendar day (stored at UTC midnight) and is still good on that day.
 */
export function isCleared(u: { volunteerClearedAt: Date | string | null; volunteerClearedUntil?: Date | string | null }, now = new Date()): boolean {
  if (!u.volunteerClearedAt) return false;
  if (!u.volunteerClearedUntil) return true;
  const until = new Date(u.volunteerClearedUntil);
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return until.getTime() >= today;
}

/** Days until a clearance runs out (negative once it has), or null with no end date */
export function clearanceDaysLeft(until: Date | string | null | undefined, now = new Date()): number | null {
  if (!until) return null;
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((new Date(until).getTime() - today) / 86_400_000);
}

export type VolunteerStatus = "PENDING" | "CONFIRMED" | "DECLINED";

export const VOLUNTEER_STATUS_INFO: Record<VolunteerStatus, { label: string; badge: "success" | "warning" | "neutral" }> = {
  CONFIRMED: { label: "Confirmed",            badge: "success" },
  PENDING:   { label: "Waiting for a reply", badge: "warning" },
  DECLINED:  { label: "Can't make it",       badge: "neutral" },
};

/** A meeting's coverage: how many confirmed adults it has against what it needs */
export function coverage(volunteers: { status: string }[], minAdults: number) {
  const confirmed = volunteers.filter((v) => v.status === "CONFIRMED").length;
  const pending = volunteers.filter((v) => v.status === "PENDING").length;
  return { confirmed, pending, needed: Math.max(0, minAdults - confirmed), covered: confirmed >= minAdults };
}

/** "3:30 PM" from "15:30" */
export function time12(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h)) return hhmm;
  return `${((h + 11) % 12) + 1}:${String(m ?? 0).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

/** "Tue, Nov 4 · 3:00 PM – 6:00 PM" — meeting dates are calendar days stored at UTC midnight */
export function shiftWhen(m: { date: Date | string; startTime: string; endTime: string }): string {
  const day = new Date(m.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
  return `${day} · ${time12(m.startTime)} – ${time12(m.endTime)}`;
}
