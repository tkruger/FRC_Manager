// Who a Head Mentor's broadcast can go to, by base role. Client-safe.
//   students — Team Members who aren't adults
//   parents  — Parents (and volunteer coordinators who aren't mentors)
//   mentors  — Mentors and Head Mentors

export const BROADCAST_GROUPS = [
  { id: "students", label: "Team Members", hint: "students" },
  { id: "parents",  label: "Parents",      hint: "and volunteer coordinators" },
  { id: "mentors",  label: "Mentors",      hint: "and Head Mentors" },
] as const;
export type BroadcastGroup = (typeof BROADCAST_GROUPS)[number]["id"];

export const isBroadcastGroup = (v: string): v is BroadcastGroup => BROADCAST_GROUPS.some((g) => g.id === v);

export function groupOf(roles: readonly string[]): BroadcastGroup | null {
  if (roles.includes("MENTOR") || roles.includes("HEAD_MENTOR")) return "mentors";
  if (roles.includes("PARENT") || roles.includes("VOLUNTEER_COORDINATOR")) return "parents";
  if (roles.includes("TEAM_MEMBER")) return "students";
  return null;
}
