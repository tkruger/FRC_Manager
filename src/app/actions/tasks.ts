"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
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

  const task = await prisma.task.create({
    data: {
      seasonId:             activeSeason.id,
      createdById:          session.user.id,
      name:                 d.name,
      description:          d.description,
      subTeam:              (d.subTeam as SubTeam) || null,
      robotId:              d.robotId || null,
      startDate:            d.startDate ? new Date(d.startDate) : null,
      dueDate:              d.dueDate ? new Date(d.dueDate) : null,
      estimatedHours:       d.estimatedHours,
      priority:             d.priority as TaskPriority,
      isMilestone:          d.isMilestone ?? false,
      designReviewRequired: d.designReviewRequired ?? false,
      designReviewStatus:   d.designReviewRequired ? "PENDING" : "NOT_REQUIRED",
      blockersNotes:        d.blockersNotes,
      assignees:            assigneeIds.length ? { connect: assigneeIds.map((id) => ({ id })) } : undefined,
      prerequisites:        prerequisiteIds.length ? { connect: prerequisiteIds.map((id) => ({ id })) } : undefined,
    },
  });

  revalidatePath("/schedule");
  return { success: true, taskId: task.id };
}

export async function updateTaskStatusAction(
  taskId: string,
  status: TaskStatus
): Promise<{ success: boolean }> {
  const session = await auth();
  if (!session) return { success: false };

  await prisma.task.update({
    where: { id: taskId },
    data: {
      status,
      completionDate: status === "COMPLETE" ? new Date() : null,
    },
  });

  revalidatePath("/schedule");
  revalidatePath(`/schedule/tasks/${taskId}`);
  return { success: true };
}

export async function updateTaskAction(
  taskId: string,
  _prev: TaskActionState | null,
  formData: FormData
): Promise<TaskActionState> {
  const session = await auth();
  if (!session) return { success: false, error: "Not authenticated." };

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
  });

  if (!parsed.success) return { success: false, error: "Invalid data." };
  const d = parsed.data;

  await prisma.task.update({
    where: { id: taskId },
    data: {
      name:                 d.name,
      description:          d.description,
      subTeam:              (d.subTeam as SubTeam) || null,
      robotId:              d.robotId || null,
      startDate:            d.startDate ? new Date(d.startDate) : null,
      dueDate:              d.dueDate ? new Date(d.dueDate) : null,
      estimatedHours:       d.estimatedHours,
      priority:             d.priority as TaskPriority,
      isMilestone:          d.isMilestone ?? false,
      designReviewRequired: d.designReviewRequired ?? false,
      designReviewStatus:   d.designReviewRequired ? "PENDING" : "NOT_REQUIRED",
      blockersNotes:        d.blockersNotes,
      assignees:            { set: assigneeIds.map((id) => ({ id })) },
      prerequisites:        { set: prerequisiteIds.map((id) => ({ id })) },
    },
  });

  revalidatePath("/schedule");
  revalidatePath(`/schedule/tasks/${taskId}`);
  return { success: true, taskId };
}

export async function deleteTaskAction(taskId: string): Promise<{ success: boolean }> {
  const session = await auth();
  if (!session) return { success: false };
  await prisma.task.delete({ where: { id: taskId } });
  revalidatePath("/schedule");
  return { success: true };
}

export async function logActualHoursAction(
  taskId: string,
  hours: number
): Promise<{ success: boolean }> {
  await prisma.task.update({ where: { id: taskId }, data: { actualHours: hours } });
  revalidatePath(`/schedule/tasks/${taskId}`);
  return { success: true };
}
