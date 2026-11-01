// Who's looking — parents, students or mentors — so Home and the phone's bottom bar can put what
// matters most to them first. Client-safe.

import { isViewOnly } from "@/lib/access/read-only";

export type Audience = "parent" | "student" | "mentor";

export function audienceOf(roles: readonly string[] | undefined): Audience {
  const r = roles ?? [];
  if (r.some((x) => x === "MENTOR" || x === "HEAD_MENTOR")) return "mentor";
  if (isViewOnly(r as never) || r.includes("VOLUNTEER_COORDINATOR")) return "parent";
  return "student";
}

/** The phone's bottom bar: four tabs per audience (the rest are under More) */
export const MOBILE_TABS_BY_AUDIENCE: Record<Audience, string[]> = {
  parent:  ["/volunteers", "/calendar", "/competitions", "/settings/season"],
  student: ["/tasks", "/calendar", "/competitions", "/tools"],
  mentor:  ["/tasks", "/procurement", "/budget", "/calendar"],
};
