// Budget categories a team marked "Not used" this season (no pneumatics, say) — left out of the
// category pickers. Server-only.

import { prisma } from "@/lib/prisma";
import type { BudgetCategoryType } from "@/generated/prisma";

export async function unusedBudgetCategories(teamId: string): Promise<BudgetCategoryType[]> {
  const rows = await prisma.budgetCategory.findMany({
    where:  { notUsed: true, budget: { season: { teamId, isActive: true } } },
    select: { type: true },
  });
  return rows.map((r) => r.type);
}
