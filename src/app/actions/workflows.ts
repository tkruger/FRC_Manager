"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { WorkflowSchema, type WorkflowDef } from "@/lib/workflow/types";
import { DEFAULT_PURCHASE_WORKFLOW } from "@/lib/workflow/default-purchase";
import type { Prisma } from "@/generated/prisma";

export type WorkflowSaveResult =
  | { success: true; version: number }
  | { success: false; error: string };

async function requireHeadMentor() {
  const session = await auth();
  if (!session?.user?.teamId) return null;
  if (!session.user.roles.includes("HEAD_MENTOR")) return null;
  return { userId: session.user.id, teamId: session.user.teamId };
}

/**
 * Saving never edits a version in place: it creates version N+1 and makes it active.
 * Requests already in flight keep following the version they started on.
 */
async function publish(teamId: string, userId: string, def: WorkflowDef): Promise<number> {
  return prisma.$transaction(async (tx) => {
    const latest = await tx.workflowDefinition.findFirst({
      where:   { teamId, kind: "PURCHASE" },
      orderBy: { version: "desc" },
      select:  { version: true },
    });
    const version = (latest?.version ?? 0) + 1;
    await tx.workflowDefinition.updateMany({
      where: { teamId, kind: "PURCHASE", isActive: true },
      data:  { isActive: false },
    });
    await tx.workflowDefinition.create({
      data: {
        teamId,
        kind:        "PURCHASE",
        version,
        definition:  def as unknown as Prisma.InputJsonValue,
        isActive:    true,
        createdById: userId,
      },
    });
    return version;
  });
}

export async function saveWorkflowAction(def: unknown): Promise<WorkflowSaveResult> {
  const who = await requireHeadMentor();
  if (!who) return { success: false, error: "Only Head Mentors can change the workflow." };

  const parsed = WorkflowSchema.safeParse(def);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Workflow is invalid." };
  }

  const version = await publish(who.teamId, who.userId, parsed.data);
  revalidatePath("/settings/workflows");
  return { success: true, version };
}

export async function resetWorkflowAction(): Promise<WorkflowSaveResult> {
  const who = await requireHeadMentor();
  if (!who) return { success: false, error: "Only Head Mentors can change the workflow." };

  const version = await publish(who.teamId, who.userId, DEFAULT_PURCHASE_WORKFLOW);
  revalidatePath("/settings/workflows");
  return { success: true, version };
}

export async function restoreWorkflowVersionAction(definitionId: string): Promise<WorkflowSaveResult> {
  const who = await requireHeadMentor();
  if (!who) return { success: false, error: "Only Head Mentors can change the workflow." };

  const row = await prisma.workflowDefinition.findFirst({
    where: { id: definitionId, teamId: who.teamId, kind: "PURCHASE" },
  });
  if (!row) return { success: false, error: "Version not found." };

  const parsed = WorkflowSchema.safeParse(row.definition);
  if (!parsed.success) return { success: false, error: "That version is no longer valid and can't be restored." };

  const version = await publish(who.teamId, who.userId, parsed.data);
  revalidatePath("/settings/workflows");
  return { success: true, version };
}
