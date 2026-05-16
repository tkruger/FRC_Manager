import type { PurchaseStatus, RequestPriority } from "@/generated/prisma";

export function statusBadgeVariant(status: PurchaseStatus): "success" | "warning" | "danger" | "info" | "neutral" {
  switch (status) {
    case "APPROVED":       return "success";
    case "RECEIVED":       return "success";
    case "SUBMITTED":      return "warning";
    case "ORDERED":        return "info";
    case "PARTIAL_RECEIVED": return "info";
    case "DENIED":         return "danger";
    case "CANCELLED":      return "neutral";
    default:               return "neutral";
  }
}

export function statusLabel(status: PurchaseStatus): string {
  return status.replace(/_/g, " ");
}

export function priorityBadgeVariant(priority: RequestPriority): "danger" | "warning" | "neutral" {
  switch (priority) {
    case "EMERGENCY": return "danger";
    case "URGENT":    return "warning";
    default:          return "neutral";
  }
}

export const SUBTEAM_OPTIONS = [
  { value: "MECHANICAL",   label: "Mechanical" },
  { value: "ELECTRICAL",   label: "Electrical" },
  { value: "PROGRAMMING",  label: "Programming" },
  { value: "DRIVE_TEAM",   label: "Drive Team" },
  { value: "STRATEGY",     label: "Strategy" },
  { value: "DESIGN",       label: "Design" },
  { value: "OUTREACH",     label: "Outreach" },
  { value: "OPERATIONS",   label: "Operations" },
];

export const BUDGET_CATEGORY_OPTIONS = [
  { value: "ROBOT_MECHANICAL",  label: "Robot — Mechanical" },
  { value: "ROBOT_ELECTRICAL",  label: "Robot — Electrical" },
  { value: "ROBOT_PNEUMATICS",  label: "Robot — Pneumatics" },
  { value: "RAW_MATERIALS",     label: "Raw Materials" },
  { value: "TOOLS_EQUIPMENT",   label: "Tools & Equipment" },
  { value: "CONSUMABLES",       label: "Consumables" },
  { value: "SAFETY_EQUIPMENT",  label: "Safety Equipment" },
  { value: "OTHER",             label: "Other" },
];
