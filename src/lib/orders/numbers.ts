// Final item IDs (0401, 0402, …). Server-only.
//
// Items are drafts until their order is finalized (approved and sent to the Team Admin),
// so denied or canceled orders never use up numbers. Until then they show a draft ID.

import type { Prisma } from "@/generated/prisma";

type Tx = Prisma.TransactionClient;

/**
 * Give the next team-sequential IDs to any of these items that don't have one yet.
 * Returns item id → number for everything it numbered.
 */
export async function assignItemNumbers(
  tx: Tx,
  teamId: string,
  where: { requestId: string } | { itemIds: string[] },
): Promise<Map<string, number>> {
  const drafts = await tx.purchaseLineItem.findMany({
    where:   { orderNumber: null, ...("requestId" in where ? { requestId: where.requestId } : { id: { in: where.itemIds } }) },
    select:  { id: true },
    orderBy: { id: "asc" }, // creation order
  });
  const numbers = new Map<string, number>();
  if (drafts.length === 0) return numbers;

  const { nextOrderItemNumber } = await tx.team.update({
    where:  { id: teamId },
    data:   { nextOrderItemNumber: { increment: drafts.length } },
    select: { nextOrderItemNumber: true },
  });
  const first = nextOrderItemNumber - drafts.length;
  for (const [idx, d] of drafts.entries()) {
    await tx.purchaseLineItem.update({ where: { id: d.id }, data: { orderNumber: first + idx } });
    numbers.set(d.id, first + idx);
  }
  return numbers;
}
