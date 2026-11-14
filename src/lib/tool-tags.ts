// Tool asset tags. Server-only.

import type { Prisma, PrismaClient } from "@/generated/prisma";

type Db = PrismaClient | Prisma.TransactionClient;

/** Next free auto tags for the team: TOOL-0001, TOOL-0002, … (skips any already in use). */
export async function allocateToolTags(db: Db, teamId: string, count: number): Promise<string[]> {
  const tags: string[] = [];
  while (tags.length < count) {
    const need = count - tags.length;
    const { nextToolNumber } = await db.team.update({
      where:  { id: teamId },
      data:   { nextToolNumber: { increment: need } },
      select: { nextToolNumber: true },
    });
    const candidates = Array.from({ length: need }, (_, i) => `TOOL-${String(nextToolNumber - need + i).padStart(4, "0")}`);
    const taken = new Set((await db.tool.findMany({
      where:  { teamId, assetTag: { in: candidates } },
      select: { assetTag: true },
    })).map((t) => t.assetTag));
    tags.push(...candidates.filter((c) => !taken.has(c)));
  }
  return tags;
}
