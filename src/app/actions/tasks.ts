"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import * as notify from "@/lib/notify/events";
import type { TaskStatus, TaskPriority, SubTeam, DesignReviewStatus } from "@/generated/prisma";

const TaskSchema = z.object({
  name:                 z.string().min(1),
  description:          z.string().optional(),
  subTeam:              z.string().optional(),
  robotId:              z.string().optional(),
  startDate:            z.string().optional(),
  dueDate:              z.string().optional(),
  estimatedHours:       z.coerce.number().min(0).optional(),
  priority:             z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]).default("MEDIUM"),
  isMilestone:          z.coerce.boolean().optional(),
  designReviewRequired: z.coerce.boolean().optional(),
  blockersNotes:        z.string().optional(),
  assigneeIds:          z.array(z.string()).optional(),
  prerequisiteIds:      z.array(z.string()).optional(),
});

/** The task if it belongs to the caller's team. */
async function findTeamTask(taskId: string, teamId: string) {
  return prisma.task.findFirst({ where: { id: taskId, season: { teamId } }, select: { id: true, seasonId: true } });
}

/** Drop any assignee, prerequisite or robot id that isn't from this team / season. */
async function scopeTaskRefs(
  teamId: string,
  seasonId: string,
  refs: { assigneeIds: string[]; prerequisiteIds: string[]; robotId?: string | null; selfId?: string },
) {
  const [members, prereqs, robot] = await Promise.all([
    refs.assigneeIds.length
      ? prisma.user.findMany({ where: { id: { in: refs.assigneeIds }, teamId, status: "ACTIVE" }, select: { id: true } })
      : [],
    refs.prerequisiteIds.length
      ? prisma.task.findMany({ where: { id: { in: refs.prerequisiteIds, not: refs.selfId }, seasonId }, select: { id: true } })
      : [],
    refs.robotId
      ? prisma.robot.findFirst({ where: { id: refs.robotId, season: { teamId } }, select: { id: true } })
      : null,
  ]);
  return {
    assigneeIds:     members.map((m) => m.id),
    prerequisiteIds: prereqs.map((p) => p.id),
    robotId:         robot?.id ?? null,
  };
}

const TASK_STATUSES: TaskStatus[] = ["NOT_STARTED", "IN_PROGRESS", "BLOCKED", "IN_REVIEW", "COMPLETE"];

export type TaskActionState =
  | { success: true; taskId: string }
  | { success: false; error: string };

export async function createTaskAction(
  _prev: TaskActionState | null,
  formData: FormData
): Promise<TaskActionState> {
  const session = await auth();
  if (!session?.user?.teamId) return { success: false, error: "Not authenticated." };

  const activeSeason = await prisma.season.findFirst({
    where: { teamId: session.user.teamId, isActive: true },
  });
  if (!activeSeason) return { success: false, error: "No active season." };

  const assigneeIds = formData.getAll("assigneeIds") as string[];
  const prerequisiteIds = formData.getAll("prerequisiteIds") as string[];

  const parsed = TaskSchema.safeParse({
    name:                 formData.get("name"),
    description:          formData.get("description") || undefined,
    subTeam:              formData.get("subTeam") || undefined,
    robotId:              formData.get("robotId") || undefined,
    startDate:            formData.get("startDate") || undefined,
    dueDate:              formData.get("dueDate") || undefined,
    estimatedHours:       formData.get("estimatedHours") || undefined,
    priority:             formData.get("priority") || "MEDIUM",
    isMilestone:          formData.get("isMilestone") === "on",
    designReviewRequired: formData.get("designReviewRequired") === "on",
    blockersNotes:        formData.get("blockersNotes") || undefined,
    assigneeIds,
    prerequisiteIds,
  });

  if (!parsed.success) return { success: false, error: "Please fill in all required fields." };
  const d = parsed.data;
  const refs = await scopeTaskRefs(session.user.teamId, activeSeason.id, { assigneeIds, prerequisiteIds, robotId: d.robotId });

  const task = await prisma.task.create({
    data: {
      seasonId:             activeSeason.id,
      createdById:          session.user.id,
      name:                 d.name,
      description:          d.description,
      subTeam:              (d.subTeam as SubTeam) || null,
      robotId:              refs.robotId,
      startDate:            d.startDate ? new Date(d.startDate) : null,
      dueDate:              d.dueDate ? new Date(d.dueDate) : null,
      estimatedHours:       d.estimatedHours,
      priority:             d.priority as TaskPriority,
      isMilestone:          d.isMilestone ?? false,
      designReviewRequired: d.designReviewRequired ?? false,
      designReviewStatus:   d.designReviewRequired ? "PENDING" : "NOT_REQUIRED",
      blockersNotes:        d.blockersNotes,
      assignees:            refs.assigneeIds.length ? { connect: refs.assigneeIds.map((id) => ({ id })) } : undefined,
      prerequisites:        refs.prerequisiteIds.length ? { connect: refs.prerequisiteIds.map((id) => ({ id })) } : undefined,
    },
  });

  if (refs.assigneeIds.length) await notify.taskAssigned(task.id, refs.assigneeIds, session.user.id);

  revalidatePath("/tasks");
  return { success: true, taskId: task.id };
}

export async function updateTaskStatusAction(
  taskId: string,
  status: TaskStatus
): Promise<{ success: boolean }> {
  const session = await auth();
  if (!session?.user?.teamId) return { success: false };
  if (!TASK_STATUSES.includes(status)) return { success: false };

  const prev = await prisma.task.findFirst({ where: { id: taskId, season: { teamId: session.user.teamId } }, select: { status: true } });
  if (!prev) return { success: false };
  await prisma.task.update({
    where: { id: taskId },
    data: {
      status,
      completionDate: status === "COMPLETE" ? new Date() : null,
    },
  });
  if (status === "BLOCKED" && prev?.status !== "BLOCKED") await notify.taskBlocked(taskId, session.user.id);

  revalidatePath("/tasks");
  revalidatePath(`/tasks/${taskId}`);
  return { success: true };
}

export async function updateTaskAction(
  taskId: string,
  _prev: TaskActionState | null,
  formData: FormData
): Promise<TaskActionState> {
  const session = await auth();
  if (!session?.user?.teamId) return { success: false, error: "Not authenticated." };

  const owned = await findTeamTask(taskId, session.user.teamId);
  if (!owned) return { success: false, error: "Task not found." };

  const assigneeIds = formData.getAll("assigneeIds") as string[];
  const prerequisiteIds = formData.getAll("prerequisiteIds") as string[];

  const rawStatus = formData.get("status") as TaskStatus | null;
  if (rawStatus && !TASK_STATUSES.includes(rawStatus)) return { success: false, error: "Invalid status." };
  const status = rawStatus || undefined;

  const parsed = TaskSchema.safeParse({
    name:                 formData.get("name"),
    description:          formData.get("description") || undefined,
    subTeam:              formData.get("subTeam") || undefined,
    robotId:              formData.get("robotId") || undefined,
    startDate:            formData.get("startDate") || undefined,
    dueDate:              formData.get("dueDate") || undefined,
    estimatedHours:       formData.get("estimatedHours") || undefined,
    priority:             formData.get("priority") || "MEDIUM",
    isMilestone:          formData.get("isMilestone") === "on",
    designReviewRequired: formData.get("designReviewRequired") === "on",
    blockersNotes:        formData.get("blockersNotes") || undefined,
  });

  if (!parsed.success) return { success: false, error: "Invalid data." };
  const d = parsed.data;
  const refs = await scopeTaskRefs(session.user.teamId, owned.seasonId, { assigneeIds, prerequisiteIds, robotId: d.robotId, selfId: taskId });

  const prev = await prisma.task.findUnique({
    where:  { id: taskId },
    select: { status: true, assignees: { select: { id: true } } },
  });

  await prisma.task.update({
    where: { id: taskId },
    data: {
      name:                 d.name,
      description:          d.description,
      subTeam:              (d.subTeam as SubTeam) || null,
      robotId:              refs.robotId,
      startDate:            d.startDate ? new Date(d.startDate) : null,
      dueDate:              d.dueDate ? new Date(d.dueDate) : null,
      estimatedHours:       d.estimatedHours,
      priority:             d.priority as TaskPriority,
      isMilestone:          d.isMilestone ?? false,
      designReviewRequired: d.designReviewRequired ?? false,
      designReviewStatus:   d.designReviewRequired ? "PENDING" : "NOT_REQUIRED",
      blockersNotes:        d.blockersNotes,
      assignees:            { set: refs.assigneeIds.map((id) => ({ id })) },
      prerequisites:        { set: refs.prerequisiteIds.map((id) => ({ id })) },
      ...(status ? {
        status,
        completionDate: status === "COMPLETE" ? new Date() : null,
      } : {}),
    },
  });

  const previousAssignees = new Set(prev?.assignees.map((a) => a.id));
  const added = refs.assigneeIds.filter((id) => !previousAssignees.has(id));
  if (added.length) await notify.taskAssigned(taskId, added, session.user.id);
  if (status === "BLOCKED" && prev?.status !== "BLOCKED") await notify.taskBlocked(taskId, session.user.id);

  revalidatePath("/tasks");
  revalidatePath(`/tasks/${taskId}`);
  return { success: true, taskId };
}

export async function deleteTaskAction(taskId: string): Promise<{ success: boolean }> {
  const session = await auth();
  if (!session?.user?.teamId) return { success: false };
  const deleted = await prisma.task.deleteMany({ where: { id: taskId, season: { teamId: session.user.teamId } } });
  if (deleted.count === 0) return { success: false };
  revalidatePath("/tasks");
  return { success: true };
}

export async function logActualHoursAction(
  taskId: string,
  hours: number
): Promise<{ success: boolean }> {
  // Previously had no auth check at all
  const session = await auth();
  if (!session?.user?.teamId) return { success: false };
  if (!Number.isFinite(hours) || hours < 0) return { success: false };
  const updated = await prisma.task.updateMany({
    where: { id: taskId, season: { teamId: session.user.teamId } },
    data:  { actualHours: hours },
  });
  if (updated.count === 0) return { success: false };
  revalidatePath(`/tasks/${taskId}`);
  return { success: true };
}


/**
 * Kanban "Future" column: the task waits until a later start date. It becomes Not started
 * with that start date; a due date that would fall before it moves too, keeping the task's
 * length. `startDate` is YYYY-MM-DD and must be after today.
 */
export async function scheduleTaskStartAction(taskId: string, startDate: string): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.teamId) return { success: false, error: "Not authenticated." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return { success: false, error: "Pick a start date." };

  const start = new Date(`${startDate}T00:00:00.000Z`);
  const todayUtc = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
  if (start <= todayUtc) return { success: false, error: "Pick a date after today." };

  const task = await prisma.task.findFirst({
    where:  { id: taskId, season: { teamId: session.user.teamId } },
    select: { startDate: true, dueDate: true },
  });
  if (!task) return { success: false, error: "Task not found." };

  let dueDate = task.dueDate;
  if (dueDate && dueDate < start) {
    const length = task.startDate ? Math.max(0, dueDate.getTime() - task.startDate.getTime()) : 0;
    dueDate = new Date(start.getTime() + length);
  }

  await prisma.task.update({
    where: { id: taskId },
    data:  { status: "NOT_STARTED", completionDate: null, startDate: start, dueDate },
  });
  revalidatePath("/tasks");
  revalidatePath(`/tasks/${taskId}`);
  return { success: true };
}
