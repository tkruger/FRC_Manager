import type { Role } from "@/generated/prisma";

const ROLE_RANK: Record<Role, number> = {
  TEAM_MEMBER:    1,
  BUILD_LEAD:     2,
  INVENTORY_ADMIN:3,
  BUDGET_MANAGER: 3,
  SAFETY_CAPTAIN: 3,
  TEAM_ADMIN:     5,
  TEAM_LEADERSHIP:8,
  MENTOR:         8,
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
export const LEADERSHIP_ROLES: Role[] = ["HEAD_MENTOR", "TEAM_LEADERSHIP", "MENTOR"];

/**
 * Roles a member effectively has. A Mentor can see and manage everything Team Leadership
 * can, so Mentor also counts as TEAM_LEADERSHIP — every permission check that names Team
 * Leadership (pages, actions, workflow steps, notifications) then covers Mentors too.
 */
export function withImpliedRoles<T extends string>(roles: T[]): T[] {
  const out = new Set<string>(roles);
  if (out.has("MENTOR")) out.add("TEAM_LEADERSHIP");
  return [...out] as T[];
}

/** For database queries that look people up by role: who holds `roles`, counting implied ones */
export function rolesThatImply<T extends string>(roles: T[]): T[] {
  const out = new Set<string>(roles);
  if (out.has("TEAM_LEADERSHIP")) out.add("MENTOR");
  return [...out] as T[];
}

// Who can edit robot details (creating robots stays Head Mentor only)
export const ROBOT_EDIT_ROLES: Role[] = ["HEAD_MENTOR", "TEAM_LEADERSHIP", "BUILD_LEAD"];
