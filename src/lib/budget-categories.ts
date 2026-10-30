// Budget categories: their names, the ones an order can be charged to, and the best guess
// for an inventory item. Safe to import on server and client.

import type { BudgetCategoryType, ItemCategory } from "@/generated/prisma";

export const BUDGET_CATEGORY_LABELS: Record<BudgetCategoryType, string> = {
  REGISTRATION_FEES: "Registration & Competition Fees",
  ROBOT_MECHANICAL:  "Robot Parts — Mechanical",
  ROBOT_ELECTRICAL:  "Robot Parts — Electrical",
  ROBOT_PNEUMATICS:  "Robot Parts — Pneumatics",
  RAW_MATERIALS:     "Raw Materials",
  TOOLS_EQUIPMENT:   "Tools & Equipment",
  CONSUMABLES:       "Consumables",
  SAFETY_EQUIPMENT:  "Safety Equipment",
  TRAVEL_HOTEL:      "Travel & Hotel",
  FOOD_MEALS:        "Food & Meals",
  AWARDS_OUTREACH:   "Awards & Outreach",
  CONTINGENCY:       "Contingency Reserve",
  SHIPPING:          "Shipping",
  OTHER:             "Other",
};

/** What an order (or one of its items) can be charged to — robot and shop first. (Not
 *  Shipping: that's filled from the shipping the Buyer enters per vendor.) */
export const ORDER_BUDGET_CATEGORIES: BudgetCategoryType[] = [
  "ROBOT_MECHANICAL", "ROBOT_ELECTRICAL", "ROBOT_PNEUMATICS", "RAW_MATERIALS",
  "TOOLS_EQUIPMENT", "CONSUMABLES", "SAFETY_EQUIPMENT",
  "AWARDS_OUTREACH", "REGISTRATION_FEES", "TRAVEL_HOTEL", "FOOD_MEALS", "OTHER",
];

export const ORDER_BUDGET_OPTIONS = ORDER_BUDGET_CATEGORIES.map((value) => ({ value, label: BUDGET_CATEGORY_LABELS[value] }));

export function isOrderBudgetCategory(v: unknown): v is BudgetCategoryType {
  return typeof v === "string" && (ORDER_BUDGET_CATEGORIES as string[]).includes(v);
}

/** The budget category an inventory item most likely belongs to */
export function budgetCategoryForItem(category: ItemCategory | null | undefined): BudgetCategoryType | null {
  switch (category) {
    case "MECHANICAL":
    case "HARDWARE":
    case "FASTENERS":   return "ROBOT_MECHANICAL";
    case "ELECTRICAL":
    case "ELECTRONICS":
    case "SENSORS":     return "ROBOT_ELECTRICAL";
    case "PNEUMATICS":  return "ROBOT_PNEUMATICS";
    case "RAW_STOCK":   return "RAW_MATERIALS";
    case "CONSUMABLES": return "CONSUMABLES";
    case "SAFETY":      return "SAFETY_EQUIPMENT";
    default:            return null;
  }
}
