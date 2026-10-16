// An order's spend in the budget. Server-only.
//
// Each item is charged to its own budget category, or the order's when it has none, so one
// order can show up as several expenses (one per category), split by the items' costs.
// Spend is recorded as "committed" when everything is ordered, and becomes a real expense
// when everything has arrived (see the workflow's order and receive steps).

import type { BudgetCategoryType, Prisma } from "@/generated/prisma";
import { BUDGET_CATEGORY_LABELS } from "@/lib/budget-categories";

type Tx = Prisma.TransactionClient;

/** Who can change an order's budget categories (at any stage, even after it's arrived) */
export const BUDGET_CATEGORY_ROLES = ["HEAD_MENTOR", "TREASURER", "BUYER", "TEAM_LEADERSHIP"];

export function canSetOrderBudget(roles: string[], userId: string, order: { requestedById: string }, canEditOrder: boolean): boolean {
  return canEditOrder || order.requestedById === userId || roles.some((r) => BUDGET_CATEGORY_ROLES.includes(r));
}

export interface SpendResult {
  /** False when the season has no budget set up */
  budget: boolean;
  /** Expenses now in the budget for this order (0 when nothing was recorded yet) */
  expenses: number;
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
      id: true, title: true, seasonId: true, budgetCategory: true,
      preferredVendor: { select: { name: true } },
      lineItems: { select: { budgetCategory: true, unitCost: true, quantity: true, vendorName: true } },
    },
  });
  const budget = await tx.budget.findUnique({
    where:   { seasonId: order.seasonId },
    include: { categories: { select: { id: true, type: true } } },
  });
  if (!budget) return { budget: false, expenses: 0 };

  const existing = await tx.expense.findMany({
    where:   { purchaseRequestId: order.id, budgetId: budget.id },
    orderBy: { date: "asc" },
  });
  if (opts.commitment === undefined && existing.length === 0) return { budget: true, expenses: 0 };

  const commitment = opts.commitment ?? existing.every((e) => e.isCommitment);
  const amount     = opts.amount ?? existing.reduce((s, e) => s + e.amount, 0);
  // A new recording happens now; a re-split keeps the original date
  const date       = opts.commitment === undefined && existing[0] ? existing[0].date : new Date();

  // Weight each category by its items' cost (or item count when nothing is priced)
  const priced = order.lineItems.some((l) => (l.unitCost ?? 0) * l.quantity > 0);
  const weights = new Map<BudgetCategoryType | null, number>();
  for (const l of order.lineItems) {
    const cat = l.budgetCategory ?? order.budgetCategory ?? null;
    weights.set(cat, (weights.get(cat) ?? 0) + (priced ? (l.unitCost ?? 0) * l.quantity : 1));
  }
  if (weights.size === 0) weights.set(order.budgetCategory ?? null, 1);
  const shares = split(amount, weights);

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
  return { budget: true, expenses: shares.size };
}
