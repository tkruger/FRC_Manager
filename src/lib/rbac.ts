import type { Role } from "@/generated/prisma";

const ROLE_RANK: Record<Role, number> = {
  TEAM_MEMBER:    1,
  BUILD_LEAD:     2,
  INVENTORY_ADMIN:3,
  BUDGET_MANAGER: 3,
  SAFETY_CAPTAIN: 3,
  TEAM_ADMIN:     5,
  TEAM_LEADERSHIP:8,
  MENTOR:         1, // same access as Team Member (add other roles for more)
  HEAD_MENTOR:    10,
};

export function hasRole(userRoles: Role[], required: Role): boolean {
  if (userRoles.includes("HEAD_MENTOR")) return true;
  return userRoles.includes(required);
}

export function hasAnyRole(userRoles: Role[], ...required: Role[]): boolean {
  if (userRoles.includes("HEAD_MENTOR")) return true;
  return required.some((r) => userRoles.includes(r));
}

export function hasMinRank(userRoles: Role[], minRole: Role): boolean {
  const maxRank = Math.max(...userRoles.map((r) => ROLE_RANK[r] ?? 0));
  return maxRank >= ROLE_RANK[minRole];
}

export const ROLE_LABELS: Record<Role, string> = {
  TEAM_MEMBER:    "Team Member",
  BUILD_LEAD:     "Build Lead",
  INVENTORY_ADMIN:"Inventory Admin",
  BUDGET_MANAGER: "Budget Manager",
  SAFETY_CAPTAIN: "Safety Captain",
  TEAM_ADMIN:     "Team Admin",
  TEAM_LEADERSHIP:"Team Leadership",
  MENTOR:         "Mentor",
  HEAD_MENTOR:    "Head Mentor",
};

// Roles that can manage team members and Discord
export const LEADERSHIP_ROLES: Role[] = ["HEAD_MENTOR", "TEAM_LEADERSHIP"];

/**
 * Roles that carry another role's access with them. Empty for now: Mentor has the same
 * access as Team Member, and gets more only from the other roles a member holds. To make a
 * role include another's access everywhere (pages, actions, workflow steps, notifications),
 * add it here, e.g. { MENTOR: ["TEAM_LEADERSHIP"] }.
 */
const IMPLIED: Partial<Record<Role, Role[]>> = {};

/** Roles a member effectively has (their own plus any implied ones) */
export function withImpliedRoles<T extends string>(roles: T[]): T[] {
  const out = new Set<string>(roles);
  for (const r of roles) for (const extra of IMPLIED[r as Role] ?? []) out.add(extra);
  return [...out] as T[];
}

/** For database queries that look people up by role: who holds `roles`, counting implied ones */
export function rolesThatImply<T extends string>(roles: T[]): T[] {
  const out = new Set<string>(roles);
  for (const [holder, extras] of Object.entries(IMPLIED)) {
    if (extras?.some((e) => out.has(e))) out.add(holder);
  }
  return [...out] as T[];
}

// Who can edit robot details (creating robots stays Head Mentor only)
export const ROBOT_EDIT_ROLES: Role[] = ["HEAD_MENTOR", "TEAM_LEADERSHIP", "BUILD_LEAD"];

/**
 * Roles someone may hand out (e.g. on an invite): any role ranked at or below their highest
 * role, and Head Mentor only by a Head Mentor. Pass the person's effective roles.
 */
export function grantableRoles(actorRoles: Role[]): Role[] {
  const top = Math.max(0, ...actorRoles.map((r) => ROLE_RANK[r] ?? 0));
  return (Object.keys(ROLE_RANK) as Role[])
    .filter((r) => (r === "HEAD_MENTOR" ? actorRoles.includes("HEAD_MENTOR") : ROLE_RANK[r] <= top))
    .sort((a, b) => ROLE_RANK[a] - ROLE_RANK[b]);
}
