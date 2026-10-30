"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { toHistoryEntries, type HistoryEntry } from "@/lib/audit/history";

const Input = z.object({
  entityType: z.enum(["order", "task", "meeting"]),
  entityId:   z.string().min(1).max(100),
});

/** An order's, task's or meeting's change history, newest first (the caller's team only) */
export async function getChangeHistoryAction(entityType: string, entityId: string): Promise<{ success: true; entries: HistoryEntry[] } | { success: false; error: string }> {
  const session = await auth();
  if (!session?.user?.teamId) return { success: false, error: "Not authenticated." };
  const parsed = Input.safeParse({ entityType, entityId });
  if (!parsed.success) return { success: false, error: "Unknown item." };

  const rows = await prisma.changeLog.findMany({
    where:   { teamId: session.user.teamId, ...parsed.data },
    orderBy: { createdAt: "desc" },
    take:    200,
    include: { actor: { select: { name: true, deletedAt: true } } },
  });
  return { success: true, entries: toHistoryEntries(rows) };
}
