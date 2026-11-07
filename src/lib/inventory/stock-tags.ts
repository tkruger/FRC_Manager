// Inventory label codes (INV-0001, …): the QR code on a bin, a sheet, an offcut. Each new item gets the
// team's next one. Server-only.

import type { Prisma, PrismaClient } from "@/generated/prisma";

type Db = PrismaClient | Prisma.TransactionClient;

export const formatStockTag = (n: number) => `INV-${String(n).padStart(4, "0")}`;

/** The team's next code (taken atomically, so two new items never share one) */
export async function nextStockTag(db: Db, teamId: string): Promise<string> {
  const t = await db.team.update({ where: { id: teamId }, data: { nextStockNumber: { increment: 1 } }, select: { nextStockNumber: true } });
  return formatStockTag(t.nextStockNumber - 1);
}

/** Same, from an inventory item's season */
export async function nextStockTagForSeason(db: Db, seasonId: string): Promise<string | null> {
  const s = await db.season.findUnique({ where: { id: seasonId }, select: { teamId: true } });
  return s ? nextStockTag(db, s.teamId) : null;
}
