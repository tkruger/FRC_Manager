// Orders & items — shared by server and client (no database access).

export const ITEM_STATUSES = ["QUEUED", "TO_ORDER", "ORDERED", "ARRIVED"] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];

export const ITEM_STATUS_INFO: Record<ItemStatus, { label: string; badge: "neutral" | "warning" | "info" | "success"; help: string }> = {
  QUEUED:   { label: "Queued",   badge: "neutral", help: "Waiting for the order to be approved" },
  TO_ORDER: { label: "To order", badge: "warning", help: "Approved — with the Team Admin to purchase" },
  ORDERED:  { label: "Ordered",  badge: "info",    help: "Purchased; a tracking link has been added" },
  ARRIVED:  { label: "Arrived",  badge: "success", help: "Delivered and added to inventory" },
};

export const IMPORTANCE_OPTIONS = [
  { value: "ROUTINE",   label: "Routine" },
  { value: "URGENT",    label: "Urgent" },
  { value: "EMERGENCY", label: "Emergency" },
] as const;
export type Importance = (typeof IMPORTANCE_OPTIONS)[number]["value"];

/** Order-level priority = the most important item (drives approval conditions and reminders) */
export function highestImportance(values: Importance[]): Importance {
  if (values.includes("EMERGENCY")) return "EMERGENCY";
  if (values.includes("URGENT")) return "URGENT";
  return "ROUTINE";
}

/** 0001, 0002, … (grows past 4 digits after 9999) */
export function formatItemId(n: number | null | undefined): string {
  return n == null ? "—" : String(n).padStart(4, "0");
}

/** Team Admin page: export the to-order CSV and add tracking links */
export const ORDER_ADMIN_ROLES = ["TEAM_ADMIN", "TEAM_LEADERSHIP", "HEAD_MENTOR"];
/** Can set an item to any status by hand ("captains" = Team Leadership) */
export const STATUS_OVERRIDE_ROLES = ["TEAM_ADMIN", "TEAM_LEADERSHIP", "HEAD_MENTOR"];

export function itemTotal(i: { unitCost: number | null; quantity: number }) {
  return (i.unitCost ?? 0) * i.quantity;
}
