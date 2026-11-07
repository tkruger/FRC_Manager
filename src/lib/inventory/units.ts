// Inventory units and how stock reads ("6 sheets", "1 partial piece — about 18 in left"). Client-safe.

export const UOM_OPTIONS = [
  { value: "EACH",    label: "Each" },    { value: "PACK",   label: "Pack" },
  { value: "FOOT",    label: "Foot" },    { value: "METER",  label: "Meter" },
  { value: "INCH",    label: "Inch" },    { value: "SHEET",  label: "Sheet" },
  { value: "POUND",   label: "Pound" },   { value: "GALLON", label: "Gallon" },
  { value: "SPOOL",   label: "Spool" },   { value: "ROLL",   label: "Roll" },
  { value: "PARTIAL", label: "Partial (part-used piece)" },
] as const;

export const isPartial = (i: { unitOfMeasure: string }) => i.unitOfMeasure === "PARTIAL";

/** "6 sheet", "1 partial piece", "2 partial pieces" */
export function stockText(i: { currentStock: number; unitOfMeasure: string }): string {
  if (isPartial(i)) return `${i.currentStock} partial piece${i.currentStock === 1 ? "" : "s"}`;
  return `${i.currentStock} ${i.unitOfMeasure.toLowerCase()}`;
}

/** Items of the same material (same name, any case/spacing) sit together, like tools */
export const groupKey = (name: string) => name.trim().replace(/\s+/g, " ").toLowerCase();
