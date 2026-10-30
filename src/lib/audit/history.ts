// Change history as shown in the app (the item's History list and the Audit log).
// Safe to import on server and client.

import type { EntityType, FieldChange } from "./changes-types";

export interface HistoryEntry {
  id:          string;
  /** ISO time */
  at:          string;
  /** null: made by the system (a background job, or someone signed out) */
  who:         string | null;
  action:      "created" | "updated" | "deleted";
  entityType:  EntityType;
  entityId:    string | null;
  entityLabel: string;
  changes:     FieldChange[];
}

interface Row {
  id: string; createdAt: Date; action: string; entityType: string; entityId: string | null; entityLabel: string;
  changes: unknown; actor: { name: string; deletedAt: Date | null } | null;
}

export function toHistoryEntries(rows: Row[]): HistoryEntry[] {
  return rows.map((r) => ({
    id: r.id,
    at: r.createdAt.toISOString(),
    who: r.actor ? (r.actor.deletedAt ? "Former member" : r.actor.name) : null,
    action: r.action as HistoryEntry["action"],
    entityType: r.entityType as EntityType,
    entityId: r.entityId,
    entityLabel: r.entityLabel,
    changes: Array.isArray(r.changes) ? (r.changes as FieldChange[]) : [],
  }));
}

/** Where an entry's order/task/meeting is shown */
export function historyHref(e: Pick<HistoryEntry, "entityType" | "entityId" | "action">): string | null {
  if (!e.entityId || e.action === "deleted") return null;
  switch (e.entityType) {
    case "order":   return `/procurement/requests/${e.entityId}`;
    case "task":    return `/tasks/${e.entityId}`;
    case "meeting": return `/calendar?meeting=${e.entityId}`;
    case "member":  return `/settings/members#member-${e.entityId}`;
  }
}

export const ENTITY_LABELS: Record<EntityType, string> = { order: "Order", task: "Task", meeting: "Meeting", member: "Member" };
