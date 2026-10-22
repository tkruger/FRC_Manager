"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import * as notify from "@/lib/notify/events";
import type { TaskStatus, TaskPriority, SubTeam, DesignReviewStatus } from "@/generated/prisma";
import { rescheduleAfter } from "@/lib/task-schedule";

const TaskSchema = z.object({
  name:                 z.string().max(300).min(1),
  subTeam:              z.string().max(300).optional(),
  robotId:              z.string().max(300).optional(),
  startDate:            z.string().max(300).optional(),
  dueDate:              z.string().max(300).optional(),
  estimatedHours:       z.coerce.number().min(0).optional(),
  priority:             z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]).default("MEDIUM"),
  isMilestone:          z.coerce.boolean().optional(),
  designReviewRequired: z.coerce.boolean().optional(),
  blockersNotes:        z.string().max(5000).optional(),
  assigneeIds:          z.array(z.string().max(100)).max(200).optional(),
  prerequisiteIds:      z.array(z.string().max(100)).max(200).optional(),
  /** "auto": dates follow the prerequisites (see task-schedule) */
  scheduleMode:         z.enum(["dates", "auto"]).default("dates"),
  durationDays:         z.coerce.number().int().min(0).max(365).optional(),
  lagDays:              z.coerce.number().int().min(-365).max(365).optional(),
});

/** The schedule fields a form submits (the same names on the create and edit forms) */
const scheduleInput = (formData: FormData) => ({
  scheduleMode: formData.get("scheduleMode") || undefined,
  durationDays: formData.get("durationDays") || undefined,
  lagDays:      formData.get("lagDays") || undefined,
});

/**
 * How a task's dates are set: its own dates, or after its prerequisites. Auto-scheduled
 * tasks need at least one prerequisite; their dates are filled in by rescheduleAfter.
 */
function scheduleData(d: z.infer<typeof TaskSchema>, prerequisiteCount: number) {
  if (d.scheduleMode === "auto") {
    if (!prerequisiteCount) return { error: "Pick at least one prerequisite to schedule this task after." } as const;
    return {
      data: { autoSchedule: true, durationDays: d.isMilestone ? 0 : Math.max(1, d.durationDays ?? 1), lagDays: d.lagDays ?? 1 },
    } as const;
  }
  return {
    data: {
      autoSchedule: false,
      startDate: d.startDate ? new Date(d.startDate) : null,
      dueDate:   d.dueDate ? new Date(d.dueDate) : null,
    },
  } as const;
}

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
  | { success: true; taskId: string; /** Tasks after it that moved with its due date */ moved?: number }
  | { success: false; error: string };

/** Markdown details from a form: trimmed, "" → null (clears), missing field → undefined (unchanged) */
function detailsFrom(formData: FormData): string | null | undefined {
  const v = formData.get("details");
  if (typeof v !== "string") return undefined;
  // Browsers submit textarea line breaks as \r\n
  return v.replace(/\r\n?/g, "\n").trim().slice(0, 20000) || null;
}

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
    ...scheduleInput(formData),
  });

  if (!parsed.success) return { success: false, error: "Please fill in all required fields." };
  const d = parsed.data;
  const refs = await scopeTaskRefs(session.user.teamId, activeSeason.id, { assigneeIds, prerequisiteIds, robotId: d.robotId });
  const schedule = scheduleData(d, refs.prerequisiteIds.length);
  if ("error" in schedule) return { success: false, error: schedule.error! };

  const task = await prisma.task.create({
    data: {
      seasonId:             activeSeason.id,
      createdById:          session.user.id,
      name:                 d.name,
      details:              detailsFrom(formData),
      subTeam:              (d.subTeam as SubTeam) || null,
      robotId:              refs.robotId,
      ...schedule.data,
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
  // Scheduled after its prerequisites: work out its dates now
  if (task.autoSchedule) await rescheduleAfter(activeSeason.id, [task.id]);

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
    subTeam:              formData.get("subTeam") || undefined,
    robotId:              formData.get("robotId") || undefined,
    startDate:            formData.get("startDate") || undefined,
    dueDate:              formData.get("dueDate") || undefined,
    estimatedHours:       formData.get("estimatedHours") || undefined,
    priority:             formData.get("priority") || "MEDIUM",
    isMilestone:          formData.get("isMilestone") === "on",
    designReviewRequired: formData.get("designReviewRequired") === "on",
    blockersNotes:        formData.get("blockersNotes") || undefined,
    ...scheduleInput(formData),
  });

  if (!parsed.success) return { success: false, error: "Invalid data." };
  const d = parsed.data;
  const refs = await scopeTaskRefs(session.user.teamId, owned.seasonId, { assigneeIds, prerequisiteIds, robotId: d.robotId, selfId: taskId });
  const schedule = scheduleData(d, refs.prerequisiteIds.length);
  if ("error" in schedule) return { success: false, error: schedule.error! };
  // A prerequisite that (through others) already comes after this task would be a loop
  if (refs.prerequisiteIds.length && await comesAfter(taskId, refs.prerequisiteIds, owned.seasonId)) {
    return { success: false, error: "One of those prerequisites already depends on this task, so that would be a loop." };
  }

  const prev = await prisma.task.findUnique({
    where:  { id: taskId },
    select: { status: true, dueDate: true, assignees: { select: { id: true } } },
  });

  await prisma.task.update({
    where: { id: taskId },
    data: {
      name:                 d.name,
      details:              detailsFrom(formData),
      subTeam:              (d.subTeam as SubTeam) || null,
      robotId:              refs.robotId,
      ...schedule.data,
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

  // Due date moved and "move what comes after" was ticked: shift the tasks after it that
  // have their own dates by the same number of days. Then everything after it that's
  // scheduled from its prerequisites is worked out again (this task too, if it is).
  let moved = 0;
  const newDue = d.dueDate ? new Date(d.dueDate) : null;
  if (schedule.data.autoSchedule === false && formData.get("shiftDependents") === "on" && prev?.dueDate && newDue) {
    const shift = Math.round((newDue.getTime() - prev.dueDate.getTime()) / 86_400_000);
    if (shift !== 0) moved = await shiftDependents(taskId, owned.seasonId, shift);
  }
  moved += await rescheduleAfter(owned.seasonId, [taskId]);

  const previousAssignees = new Set(prev?.assignees.map((a) => a.id));
  const added = refs.assigneeIds.filter((id) => !previousAssignees.has(id));
  if (added.length) await notify.taskAssigned(taskId, added, session.user.id);
  if (status === "BLOCKED" && prev?.status !== "BLOCKED") await notify.taskBlocked(taskId, session.user.id);

  revalidatePath("/tasks");
  revalidatePath(`/tasks/${taskId}`);
  return { success: true, taskId, moved };
}

/**
 * Moves the unfinished tasks that come after a task — its dependents, theirs, and so on —
 * by `days`. Each moves once, even if it follows several of them. Returns how many moved.
 */
async function shiftDependents(taskId: string, seasonId: string, days: number): Promise<number> {
  // (moves only tasks with their own dates — see rescheduleAfter for the rest)
  const seen = new Set<string>([taskId]);
  const toMove: { id: string; startDate: Date | null; dueDate: Date | null }[] = [];
  for (let frontier = [taskId]; frontier.length; ) {
    const next = await prisma.task.findMany({
      where:  { seasonId, prerequisites: { some: { id: { in: frontier } } } },
      select: { id: true, status: true, autoSchedule: true, startDate: true, dueDate: true },
    });
    frontier = [];
    for (const t of next) {
      if (seen.has(t.id)) continue;
      seen.add(t.id);
      frontier.push(t.id);
      // Auto-scheduled tasks are worked out from their prerequisites afterwards
      if (t.status !== "COMPLETE" && !t.autoSchedule) toMove.push(t);
    }
  }
  const by = (d: Date | null) => (d ? new Date(d.getTime() + days * 86_400_000) : null);
  if (toMove.length) {
    await prisma.$transaction(toMove.map((t) => prisma.task.update({ where: { id: t.id }, data: { startDate: by(t.startDate), dueDate: by(t.dueDate) } })));
  }
  return toMove.length;
}

/** Whether any of `ids` depends (directly or through others) on `taskId` */
async function comesAfter(taskId: string, ids: string[], seasonId: string): Promise<boolean> {
  const seen = new Set<string>();
  for (let frontier = [taskId]; frontier.length; ) {
    const next = await prisma.task.findMany({ where: { seasonId, prerequisites: { some: { id: { in: frontier } } } }, select: { id: true } });
    frontier = [];
    for (const t of next) {
      if (ids.includes(t.id)) return true;
      if (!seen.has(t.id)) { seen.add(t.id); frontier.push(t.id); }
    }
  }
  return false;
}

export async function deleteTaskAction(taskId: string): Promise<{ success: boolean }> {
  const session = await auth();
  if (!session?.user?.teamId) return { success: false };
  const gone = await prisma.task.findFirst({
    where:  { id: taskId, season: { teamId: session.user.teamId } },
    select: { seasonId: true, dependents: { select: { id: true } } },
  });
  const deleted = await prisma.task.deleteMany({ where: { id: taskId, season: { teamId: session.user.teamId } } });
  if (deleted.count === 0 || !gone) return { success: false };
  // Tasks scheduled after it now follow their other prerequisites (or keep their dates)
  await rescheduleAfter(gone.seasonId, gone.dependents.map((t) => t.id));
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
    select: { seasonId: true, startDate: true, dueDate: true },
  });
  if (!task) return { success: false, error: "Task not found." };

  let dueDate = task.dueDate;
  if (dueDate && dueDate < start) {
    const length = task.startDate ? Math.max(0, dueDate.getTime() - task.startDate.getTime()) : 0;
    dueDate = new Date(start.getTime() + length);
  }

  await prisma.task.update({
    where: { id: taskId },
    // A start date picked by hand: the task keeps its own dates from now on
    data:  { status: "NOT_STARTED", completionDate: null, startDate: start, dueDate, autoSchedule: false },
  });
  await rescheduleAfter(task.seasonId, [taskId]);
  revalidatePath("/tasks");
  revalidatePath(`/tasks/${taskId}`);
  return { success: true };
}
