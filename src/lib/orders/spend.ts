// An order's spend in the budget. Server-only.
//
// Each item is charged to its own budget category, or the order's when it has none, so one
// order can show up as several expenses (one per category), split by the items' costs.
// On top of the items: each vendor's tax (entered by the Buyer) counts toward the categories
// of that vendor's items, split the same way; its shipping goes to the Shipping category.
// Spend is recorded as "committed" when everything is ordered, and becomes a real expense
// when everything has arrived (see the workflow's order and receive steps).

import type { BudgetCategoryType, Prisma } from "@/generated/prisma";
import { BUDGET_CATEGORY_LABELS } from "@/lib/budget-categories";

type Tx = Prisma.TransactionClient;

/** Who can change an order's budget categories (at any stage, even after it's arrived) */
export const BUDGET_CATEGORY_ROLES = ["HEAD_MENTOR", "BUYER", "TEAM_LEADERSHIP"];

export function canSetOrderBudget(roles: string[], userId: string, order: { requestedById: string }, canEditOrder: boolean): boolean {
  return canEditOrder || order.requestedById === userId || roles.some((r) => BUDGET_CATEGORY_ROLES.includes(r));
}

export interface SpendResult {
  /** False when the season has no budget set up */
  budget: boolean;
  /** Expenses now in the budget for this order (0 when nothing was recorded yet) */
  expenses: number;
  /** What was recorded in all: items, plus tax and shipping */
  total: number;
}

/** Split `amount` (in dollars) by weight, to the cent, with the rounding left on the biggest share */
function split(amount: number, weights: Map<BudgetCategoryType | null, number>): Map<BudgetCategoryType | null, number> {
  const cents = Math.round(amount * 100);
  const total = [...weights.values()].reduce((s, w) => s + w, 0);
  const out = new Map<BudgetCategoryType | null, number>();
  let given = 0;
  let biggest: BudgetCategoryType | null | undefined;
  for (const [k, w] of weights) {
    const c = total > 0 ? Math.floor((cents * w) / total) : 0;
    out.set(k, c);
    given += c;
    if (biggest === undefined || w > (weights.get(biggest) ?? 0)) biggest = k;
  }
  if (biggest !== undefined) out.set(biggest, (out.get(biggest) ?? 0) + cents - given);
  return new Map([...out].map(([k, c]) => [k, c / 100]));
}

/**
 * Write (or rewrite) the order's expenses so they match its items' categories.
 *  - `commitment` true/false: record committed / actual spend now (the workflow steps).
 *  - omitted: re-split whatever is already recorded (after an edit or a category change);
 *    does nothing if no spend has been recorded yet.
 *  - `amount`: the total to record; defaults to what's already recorded.
 */
export async function syncOrderSpend(
  tx: Tx,
  requestId: string,
  opts: { commitment?: boolean; amount?: number } = {},
): Promise<SpendResult> {
  const order = await tx.purchaseRequest.findUniqueOrThrow({
    where:  { id: requestId },
    select: {
      id: true, title: true, seasonId: true, budgetCategory: true, actualTotal: true,
      preferredVendor: { select: { name: true } },
      lineItems: { select: { budgetCategory: true, unitCost: true, quantity: true, vendorName: true } },
      vendorCharges: { select: { vendorName: true, tax: true, shipping: true } },
    },
  });
  const budget = await tx.budget.findUnique({
    where:   { seasonId: order.seasonId },
    include: { categories: { select: { id: true, type: true } } },
  });
  if (!budget) return { budget: false, expenses: 0, total: 0 };

  const existing = await tx.expense.findMany({
    where:   { purchaseRequestId: order.id, budgetId: budget.id },
    orderBy: { date: "asc" },
  });
  if (opts.commitment === undefined && existing.length === 0) return { budget: true, expenses: 0, total: 0 };

  const commitment = opts.commitment ?? existing.every((e) => e.isCommitment);
  // The items' cost: as given, else the order's actual total, else what the items add up to
  // (not what's recorded — that also holds tax and shipping, which are added below)
  const itemsSum = order.lineItems.reduce((sum, l) => sum + (l.unitCost ?? 0) * l.quantity, 0);
  const amount   = opts.amount ?? order.actualTotal ?? itemsSum;
  // A new recording happens now; a re-split keeps the original date
  const date       = opts.commitment === undefined && existing[0] ? existing[0].date : new Date();

  // Weight each category by its items' cost (or item count when nothing is priced)
  const weightsOf = (lines: typeof order.lineItems) => {
    const priced = lines.some((l) => (l.unitCost ?? 0) * l.quantity > 0);
    const weights = new Map<BudgetCategoryType | null, number>();
    for (const l of lines) {
      const cat = l.budgetCategory ?? order.budgetCategory ?? null;
      weights.set(cat, (weights.get(cat) ?? 0) + (priced ? (l.unitCost ?? 0) * l.quantity : 1));
    }
    if (weights.size === 0) weights.set(order.budgetCategory ?? null, 1);
    return weights;
  };
  const shares = split(amount, weightsOf(order.lineItems));
  const addTo = (part: Map<BudgetCategoryType | null, number>) => {
    for (const [k, v] of part) shares.set(k, Math.round(((shares.get(k) ?? 0) + v) * 100) / 100);
  };
  // Each vendor's tax to its items' categories; shipping to Shipping
  const vendorKey = (v: string | null | undefined) => (v ?? "").trim().toLowerCase();
  for (const c of order.vendorCharges) {
    if (c.tax > 0) addTo(split(c.tax, weightsOf(order.lineItems.filter((l) => vendorKey(l.vendorName) === vendorKey(c.vendorName)))));
    if (c.shipping > 0) addTo(new Map([["SHIPPING" as BudgetCategoryType, c.shipping]]));
  }
  for (const [k, v] of shares) if (v === 0 && shares.size > 1) shares.delete(k);

  // Categories the budget doesn't have yet are added (with nothing allocated) so the spend
  // shows under the right name instead of disappearing into "uncategorized"
  const categoryIds = new Map(budget.categories.map((c) => [c.type, c.id]));
  for (const type of shares.keys()) {
    if (type && !categoryIds.has(type)) {
      const created = await tx.budgetCategory.create({
        data:   { budgetId: budget.id, type, label: BUDGET_CATEGORY_LABELS[type], allocation: 0 },
        select: { id: true },
      });
      categoryIds.set(type, created.id);
    }
  }

  const vendors = [...new Set(order.lineItems.map((l) => l.vendorName?.trim()).filter(Boolean))];
  const vendor  = order.preferredVendor?.name ?? (vendors.length === 1 ? vendors[0]! : vendors.length > 1 ? "Several vendors" : null);
  const several = shares.size > 1;

  await tx.expense.deleteMany({ where: { id: { in: existing.map((e) => e.id) } } });
  for (const [type, share] of shares) {
    await tx.expense.create({
      data: {
        budgetId:          budget.id,
        purchaseRequestId: order.id,
        categoryId:        type ? categoryIds.get(type)! : null,
        amount:            share,
        isCommitment:      commitment,
        date,
        vendor,
        description:       `Purchase: ${order.title}${several ? ` — ${type ? BUDGET_CATEGORY_LABELS[type] : "Uncategorized"}` : ""}`,
      },
    });
  }
  return { budget: true, expenses: shares.size, total: Math.round([...shares.values()].reduce((sum, v) => sum + v, 0) * 100) / 100 };
}
