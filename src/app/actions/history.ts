"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { toHistoryEntries, type HistoryEntry } from "@/lib/audit/history";
import { canReviewClaims } from "@/lib/expense-claims";

const Input = z.object({
  entityType: z.enum(["order", "task", "meeting", "member", "expense"]),
  entityId:   z.string().min(1).max(100),
});

/** An order's, task's or meeting's change history, newest first (the caller's team only) */
export async function getChangeHistoryAction(entityType: string, entityId: string): Promise<{ success: true; entries: HistoryEntry[] } | { success: false; error: string }> {
  const session = await auth();
  if (!session?.user?.teamId) return { success: false, error: "Not authenticated." };
  const parsed = Input.safeParse({ entityType, entityId });
  if (!parsed.success) return { success: false, error: "Unknown item." };
  // A member's history is for the people who manage members and see the audit log
  // An expense claim's history: its submitter and the people who review claims
  if (parsed.data.entityType === "expense" && !canReviewClaims(session.user.roles)) {
    const mine = await prisma.expenseClaim.findFirst({ where: { id: parsed.data.entityId, submittedById: session.user.id }, select: { id: true } });
    if (!mine) return { success: false, error: "Only Treasurers, Head Mentors and the person who submitted it can see a claim's history." };
  }
  if (parsed.data.entityType === "member" && !session.user.roles.some((r) => ["HEAD_MENTOR", "TEAM_LEADERSHIP", "SAFETY_CAPTAIN"].includes(r))) {
    return { success: false, error: "Only Head Mentors and Team Leadership can see a member's history." };
  }

  const rows = await prisma.changeLog.findMany({
    where:   { teamId: session.user.teamId, ...parsed.data },
    orderBy: { createdAt: "desc" },
    take:    200,
    include: { actor: { select: { name: true, deletedAt: true } } },
  });
  return { success: true, entries: toHistoryEntries(rows) };
}
