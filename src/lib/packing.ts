// Competition packing and tool locations — shared by pages, actions and the scan API.

import type { Role } from "@/generated/prisma";

/** Who manages the master pack list and starts/finishes packing (Mentor implies Team Leadership) */
export const PACK_MANAGE_ROLES: Role[] = ["HEAD_MENTOR", "TEAM_LEADERSHIP"];
/** Who adds, renames and deletes tool locations (same people who edit tools) */
export const LOCATION_EDIT_ROLES: Role[] = ["HEAD_MENTOR", "TEAM_LEADERSHIP", "BUILD_LEAD", "INVENTORY_ADMIN"];
/** Who sees the audit log of tool checkouts and safety reports */
export const AUDIT_ROLES: Role[] = ["HEAD_MENTOR", "TEAM_LEADERSHIP", "SAFETY_CAPTAIN"];

export function canManagePacking(roles: string[]) {
  return roles.some((r) => (PACK_MANAGE_ROLES as string[]).includes(r));
}
export function canEditLocations(roles: string[]) {
  return roles.some((r) => (LOCATION_EDIT_ROLES as string[]).includes(r));
}
export function canSeeAudit(roles: string[]) {
  return roles.some((r) => (AUDIT_ROLES as string[]).includes(r));
}

/** Barcode value for the nth location: LOC-0001 */
export function locationCode(n: number): string {
  return `LOC-${String(n).padStart(4, "0")}`;
}

/** Tools with the same name (ignoring case and spaces) form one group — matches the tools list */
export function groupKey(name: string): string {
  return name.trim().toLowerCase();
}

interface ProgressItem { id: string; toolName: string | null; quantity: number }
interface ProgressEntry { itemId: string | null; tool: { name: string } | null }

/** How many of each master list line are packed, and the total (capped at what's needed) */
export function packProgress(items: ProgressItem[], entries: ProgressEntry[]) {
  const toolCounts = new Map<string, number>();
  const ticked = new Set<string>();
  for (const e of entries) {
    if (e.tool) toolCounts.set(groupKey(e.tool.name), (toolCounts.get(groupKey(e.tool.name)) ?? 0) + 1);
    if (e.itemId) ticked.add(e.itemId);
  }
  const perItem = new Map<string, number>();
  let packed = 0, needed = 0;
  for (const it of items) {
    const have = it.toolName ? toolCounts.get(groupKey(it.toolName)) ?? 0 : ticked.has(it.id) ? it.quantity : 0;
    perItem.set(it.id, have);
    packed += Math.min(have, it.quantity);
    needed += it.quantity;
  }
  return { perItem, packed, needed, done: needed > 0 && packed >= needed };
}

/** What a master list line asks for: a tool group, or a hand-ticked item */
export function packItemTitle(item: { toolName: string | null; label: string | null }): string {
  return item.toolName ?? item.label ?? "Item";
}
