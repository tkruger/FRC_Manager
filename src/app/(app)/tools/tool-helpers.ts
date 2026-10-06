// Shared by the tools list and the tool window.

export interface ToolRow {
  id: string;
  name: string;
  toolType: string;
  space: string;
  manufacturer: string | null;
  model: string | null;
  assetTag: string | null;
  homeLocation: string | null;
  condition: string;
  requiresCertification: boolean;
  certificationName: string | null;
  maintenanceIntervalDays: number | null;
  replacementCost: number | null;
  notes: string | null;
  image: string | null;
  /** Open checkout, if any — each tool is one physical item */
  checkout: { id: string; userId: string; userName: string; expectedReturn: string } | null;
}

export const CONDITION_BADGE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  EXCELLENT: "success", GOOD: "success", FAIR: "warning",
  NEEDS_REPAIR: "danger", OUT_OF_SERVICE: "danger", OUT_FOR_MAINTENANCE: "warning",
};
const UNAVAILABLE = ["OUT_OF_SERVICE", "OUT_FOR_MAINTENANCE"];

export function isAvailable(t: ToolRow) {
  return !t.checkout && !UNAVAILABLE.includes(t.condition);
}


/** Tools with the same name (ignoring case and spaces) form one group */
export function groupKey(name: string): string {
  return name.trim().toLowerCase();
}

/** The names in use (one spelling per group, A–Z) and how many tools are in each group */
export function toolGroups(tools: { name: string }[]): { names: string[]; sizes: Record<string, number> } {
  const sizes: Record<string, number> = {};
  const spelling = new Map<string, string>();
  for (const t of tools) {
    const key = groupKey(t.name);
    sizes[key] = (sizes[key] ?? 0) + 1;
    if (!spelling.has(key)) spelling.set(key, t.name.trim());
  }
  return { names: [...spelling.values()].sort((a, b) => a.localeCompare(b)), sizes };
}
