// Who a meeting is for. A whole-team meeting is for everyone; a sub-team meeting is for that
// sub-team's members plus mentors and Team Leadership, who keep an eye on every group.
// Client-safe (no database access).

import type { Role, SubTeam } from "@/generated/prisma";
import { SUBTEAM_OPTIONS } from "@/lib/schedule-helpers";

/** Always invited to sub-team meetings */
export const SUBTEAM_MEETING_ROLES: Role[] = ["HEAD_MENTOR", "MENTOR", "TEAM_LEADERSHIP"];

export const SUBTEAM_LABEL: Record<string, string> = Object.fromEntries(SUBTEAM_OPTIONS.map((o) => [o.value, o.label]));

export function invitedTo(meeting: { subTeam: SubTeam | null }, user: { roles: readonly string[]; subTeams: readonly SubTeam[] }): boolean {
  if (!meeting.subTeam) return true;
  return user.subTeams.includes(meeting.subTeam) || user.roles.some((r) => (SUBTEAM_MEETING_ROLES as string[]).includes(r));
}

/** "Programming meeting" / "Team meeting" — or its own title */
export function meetingName(m: { title: string | null; subTeam: SubTeam | null }): string {
  if (m.title) return m.subTeam ? `${m.title} (${SUBTEAM_LABEL[m.subTeam]})` : m.title;
  return m.subTeam ? `${SUBTEAM_LABEL[m.subTeam]} meeting` : "Team meeting";
}
