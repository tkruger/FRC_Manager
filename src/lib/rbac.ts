import type { Role } from "@/generated/prisma";

// Role hierarchy — each level includes all below it
const ROLE_RANK: Record<Role, number> = {
  TEAM_MEMBER:    1,
  BUILD_LEAD:     2,
  INVENTORY_ADMIN:3,
  BUDGET_MANAGER: 3,
  SAFETY_CAPTAIN: 3,
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
  HEAD_MENTOR:    "Head Mentor",
};
