// Inventory categories (the list's folders) and item types, with the names people see.
// Shared by the client and the server.

export const CATEGORY_OPTIONS = [
  { value: "UNCATEGORIZED", label: "Uncategorized" },
  { value: "MECHANICAL",    label: "Mechanical" },
  { value: "ELECTRICAL",    label: "Electrical" },
  { value: "ELECTRONICS",   label: "Electronics" },
  { value: "SENSORS",       label: "Sensors" },
  { value: "PNEUMATICS",    label: "Pneumatics" },
  { value: "HARDWARE",      label: "Hardware" },
  { value: "FASTENERS",     label: "Fasteners" },
  { value: "RAW_STOCK",     label: "Raw stock" },
  { value: "CONSUMABLES",   label: "Consumables" },
  { value: "SAFETY",        label: "Safety" },
] as const;

export type CategoryValue = (typeof CATEGORY_OPTIONS)[number]["value"];
export const CATEGORY_VALUES = CATEGORY_OPTIONS.map((c) => c.value) as [CategoryValue, ...CategoryValue[]];
/** What a new item is filed under until someone sorts it */
export const DEFAULT_CATEGORY: CategoryValue = "UNCATEGORIZED";

export const categoryLabel = (v: string) => CATEGORY_OPTIONS.find((c) => c.value === v)?.label ?? v.replace(/_/g, " ");

export const TYPE_OPTIONS = [
  { value: "DISCRETE",     label: "Discrete part" },
  { value: "RAW_MATERIAL", label: "Raw material (continuous)" },
  { value: "CONSUMABLE",   label: "Consumable" },
] as const;

/** Short names for the list and its filter */
export const typeLabel = (v: string) => ({ DISCRETE: "Discrete part", RAW_MATERIAL: "Raw material", CONSUMABLE: "Consumable" } as Record<string, string>)[v] ?? v.replace(/_/g, " ");
