"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { findTeamTemplate, findTeamTemplateTask } from "@/lib/template-access";
import { STANDARD_TASKS } from "@/lib/standard-template";
import {
  TASK_ANCHORS, STAGE_INFO, isCompetitionAnchor, legacyAnchor, resolveAnchor, addDays, week0Competition,
  type TaskAnchor, type SeasonDates,
} from "@/lib/competition";
import type { Prisma, TaskPriority, SubTeam } from "@/generated/prisma";

const MENTOR_ROLES = ["HEAD_MENTOR", "BUILD_LEAD", "INVENTORY_ADMIN"] as const;

async function requireMentor() {
  const session = await auth();
  if (!session?.user?.teamId) throw new Error("Not authenticated.");
  if (!session.user.roles.some((r) => MENTOR_ROLES.includes(r as any)))
    throw new Error("Only mentors and build leads can manage templates.");
  return session;
}

async function requireHeadMentor() {
  const session = await auth();
  if (!session?.user?.teamId) throw new Error("Not authenticated.");
  if (!session.user.roles.includes("HEAD_MENTOR" as any))
    throw new Error("Only Head Mentors can apply templates to an active season.");
  return session;
}

// ─── Custom template CRUD ───────────────────────────────────────────────────

export async function createTemplateAction(
  _prev: { success: boolean; error?: string; id?: string } | null,
  formData: FormData
): Promise<{ success: boolean; error?: string; id?: string }> {
  let session;
  try { session = await requireMentor(); } catch (e: any) { return { success: false, error: e.message }; }

  const name = (formData.get("name") as string)?.trim();
  if (!name) return { success: false, error: "Template name is required." };

  const template = await prisma.seasonTemplate.create({
    data: {
      name,
      description: (formData.get("description") as string) || null,
      createdById: session.user.id,
    },
  });

  revalidatePath("/tasks/templates");
  return { success: true, id: template.id };
}

export async function updateTemplateAction(
  templateId: string,
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  let session;
  try { session = await requireMentor(); } catch (e: any) { return { success: false, error: e.message }; }
  if (!await findTeamTemplate(templateId, session.user.teamId!)) return { success: false, error: "Template not found." };

  await prisma.seasonTemplate.update({
    where: { id: templateId },
    data: {
      name: (formData.get("name") as string)?.trim(),
      description: (formData.get("description") as string) || null,
    },
  });

  revalidatePath(`/tasks/templates/${templateId}`);
  revalidatePath("/tasks/templates");
  return { success: true };
}

export async function deleteTemplateAction(templateId: string): Promise<{ success: boolean; error?: string }> {
  let session;
  try { session = await requireMentor(); } catch (e: any) { return { success: false, error: e.message }; }
  if (!await findTeamTemplate(templateId, session.user.teamId!)) return { success: false, error: "Template not found." };
  await prisma.seasonTemplate.delete({ where: { id: templateId } });
  revalidatePath("/tasks/templates");
  return { success: true };
}

// ─── Template tasks ─────────────────────────────────────────────────────────

const TemplateTaskSchema = z.object({
  name:                 z.string().min(1),
  subTeam:              z.string().optional(),
  startOffset:          z.coerce.number().int(),        // days before (−) / after (+) the anchor
  durationBuildDays:    z.coerce.number().int().min(1).default(1),
  priority:             z.enum(["CRITICAL","HIGH","MEDIUM","LOW"]).default("MEDIUM"),
  estimatedHours:       z.coerce.number().optional(),
  isMilestone:          z.coerce.boolean().optional(),
  designReviewRequired: z.coerce.boolean().optional(),
  description:          z.string().optional(),
  anchor:               z.enum(TASK_ANCHORS).optional(),
  anchorNumber:         z.coerce.number().int().min(0).max(99).optional(),
});

/** Reads a template-task form. Forms without an anchor fall back to the old sign rule. */
function parseTemplateTaskForm(formData: FormData) {
  const parsed = TemplateTaskSchema.safeParse({
    name:                 formData.get("name"),
    subTeam:              formData.get("subTeam") || undefined,
    startOffset:          formData.get("startOffset"),
    durationBuildDays:    formData.get("durationBuildDays") || 1,
    priority:             formData.get("priority") || "MEDIUM",
    estimatedHours:       formData.get("estimatedHours") || undefined,
    isMilestone:          formData.get("isMilestone") === "on",
    designReviewRequired: formData.get("designReviewRequired") === "on",
    description:          formData.get("description") || undefined,
    anchor:               formData.get("anchor") || undefined,
    anchorNumber:         formData.get("anchorNumber") || undefined,
  });
  if (!parsed.success) return null;
  const d = parsed.data;
  const anchor: TaskAnchor = d.anchor ?? legacyAnchor(d.startOffset);
  // A number only means something for numbered competition types ("Week1"); none = each one
  const anchorNumber = isCompetitionAnchor(anchor) && STAGE_INFO[anchor].numbered ? d.anchorNumber ?? null : null;
  return {
    name:                 d.name,
    subTeam:              (d.subTeam as SubTeam) || null,
    startOffset:          d.startOffset,
    durationBuildDays:    d.durationBuildDays,
    priority:             d.priority as TaskPriority,
    estimatedHours:       d.estimatedHours,
    isMilestone:          d.isMilestone ?? false,
    designReviewRequired: d.designReviewRequired ?? false,
    description:          d.description,
    anchor,
    anchorNumber,
  };
}

export async function addTemplateTaskAction(
  templateId: string,
  _prev: { success: boolean; error?: string } | null,
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  let session;
  try { session = await requireMentor(); } catch (e: any) { return { success: false, error: e.message }; }
  if (!await findTeamTemplate(templateId, session.user.teamId!)) return { success: false, error: "Template not found." };

  const data = parseTemplateTaskForm(formData);
  if (!data) return { success: false, error: "Please fill in all required fields." };

  await prisma.templateTask.create({ data: { templateId, ...data } });

  revalidatePath(`/tasks/templates/${templateId}`);
  return { success: true };
}

export async function updateTemplateTaskAction(
  taskId: string,
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  let session;
  try { session = await requireMentor(); } catch (e: any) { return { success: false, error: e.message }; }
  const task = await findTeamTemplateTask(taskId, session.user.teamId!);
  if (!task) return { success: false, error: "Task not found." };

  const data = parseTemplateTaskForm(formData);
  if (!data) return { success: false, error: "Invalid data." };

  await prisma.templateTask.update({ where: { id: taskId }, data });

  revalidatePath(`/tasks/templates/${task.templateId}`);
  return { success: true };
}

export async function deleteTemplateTaskAction(taskId: string): Promise<{ success: boolean }> {
  let session;
  try { session = await requireMentor(); } catch { return { success: false }; }
  const task = await findTeamTemplateTask(taskId, session.user.teamId!);
  if (!task) return { success: false };
  await prisma.templateTask.delete({ where: { id: taskId } });
  revalidatePath(`/tasks/templates/${task.templateId}`);
  return { success: true };
}

// ─── Save current season tasks as a template ───────────────────────────────

export async function saveSeasonAsTemplateAction(
  name: string,
  description?: string
): Promise<{ success: boolean; error?: string; id?: string }> {
  let session;
  try { session = await requireMentor(); } catch (e: any) { return { success: false, error: e.message }; }

  const activeSeason = await prisma.season.findFirst({
    where:   { teamId: session.user.teamId, isActive: true },
    include: { competitionEvents: { select: { stage: true, stageNumber: true, startDate: true } } },
  });
  if (!activeSeason) return { success: false, error: "No active season." };

  const tasks = await prisma.task.findMany({
    where: { seasonId: activeSeason.id },
    select: { name: true, subTeam: true, startDate: true, dueDate: true, priority: true,
              isMilestone: true, estimatedHours: true, designReviewRequired: true, description: true },
  });

  if (tasks.length === 0) return { success: false, error: "No tasks in the current season to save." };

  // Convert absolute dates to offsets from whichever season date is nearest:
  // kickoff, Week 0 (the Week0 / first week competition) or the season end
  const DAY = 86400000;
  const kickoff = activeSeason.kickoffDate.getTime();
  const week0   = week0Competition(activeSeason.competitionEvents);
  const anchors: { anchor: TaskAnchor; ms: number }[] = [
    { anchor: "KICKOFF",    ms: kickoff },
    ...(week0 ? [{ anchor: "SEASON_WEEK0" as TaskAnchor, ms: week0.startDate.getTime() }] : []),
    { anchor: "SEASON_END", ms: activeSeason.endDate.getTime() },
  ];

  const template = await prisma.seasonTemplate.create({
    data: {
      name: name.trim(),
      description: description || null,
      createdById: session.user.id,
      tasks: {
        create: tasks.map((t) => {
          const startMs = t.startDate ? t.startDate.getTime() : kickoff;
          const dueMs   = t.dueDate   ? t.dueDate.getTime()   : startMs + DAY;
          const nearest = anchors
            .map((a) => ({ anchor: a.anchor, offset: Math.round((startMs - a.ms) / DAY) }))
            .sort((a, b) => Math.abs(a.offset) - Math.abs(b.offset))[0];
          const startOffset = nearest.offset;
          const durationBuildDays = Math.max(1, Math.round((dueMs - startMs) / DAY));

          return {
            name:                 t.name,
            subTeam:              t.subTeam,
            startOffset,
            anchor:               nearest.anchor,
            durationBuildDays,
            priority:             t.priority,
            isMilestone:          t.isMilestone,
            estimatedHours:       t.estimatedHours,
            designReviewRequired: t.designReviewRequired,
            description:          t.description,
          };
        }),
      },
    },
  });

  revalidatePath("/tasks/templates");
  return { success: true, id: template.id };
}

// ─── Applying templates ─────────────────────────────────────────────────────

interface ApplicableTask {
  name:                 string;
  description?:         string | null;
  subTeam:              SubTeam | null;
  startOffset:          number;
  durationBuildDays:    number;
  priority:             TaskPriority;
  estimatedHours?:      number | null;
  isMilestone:          boolean;
  designReviewRequired: boolean;
  anchor:               TaskAnchor;
  anchorNumber:         number | null;
}

export type ApplyTemplateResult = {
  success:  boolean;
  error?:   string;
  count?:   number;
  /** Template tasks whose competition isn't in this season yet */
  skipped?: string[];
};

/**
 * Turns template tasks into real tasks in the active season. Competition anchors
 * without a number create one task per matching competition ("Pack robot — Week1").
 * Tasks whose name already exists are skipped, so re-applying after adding a
 * competition only creates the new ones.
 */
async function applyToActiveSeason(teamId: string, userId: string, tasks: ApplicableTask[]): Promise<ApplyTemplateResult> {
  const season = await prisma.season.findFirst({
    where:   { teamId, isActive: true },
    include: { competitionEvents: { select: { name: true, stage: true, stageNumber: true, startDate: true } } },
  });
  if (!season) return { success: false, error: "No active season." };

  const dates: SeasonDates = {
    kickoffDate:  season.kickoffDate,
    endDate:      season.endDate,
    competitions: season.competitionEvents,
  };
  const existing = new Set(
    (await prisma.task.findMany({ where: { seasonId: season.id }, select: { name: true } })).map((t) => t.name)
  );

  const rows: Prisma.TaskCreateManyInput[] = [];
  const skipped: string[] = [];
  for (const t of tasks) {
    const targets = resolveAnchor(t.anchor, t.anchorNumber, dates);
    if (targets.length === 0) { skipped.push(t.name); continue; }
    for (const target of targets) {
      const name = target.suffix ? `${t.name} — ${target.suffix}` : t.name;
      if (existing.has(name)) continue;
      existing.add(name);
      const startDate = addDays(target.date, t.startOffset);
      rows.push({
        seasonId: season.id, createdById: userId,
        name, subTeam: t.subTeam, description: t.description ?? null,
        startDate, dueDate: addDays(startDate, t.durationBuildDays),
        priority: t.priority, isMilestone: t.isMilestone, estimatedHours: t.estimatedHours ?? null,
        designReviewRequired: t.designReviewRequired,
        designReviewStatus: t.designReviewRequired ? "PENDING" : "NOT_REQUIRED",
      });
    }
  }

  if (rows.length) await prisma.task.createMany({ data: rows });
  revalidatePath("/tasks");
  return { success: true, count: rows.length, skipped };
}

export async function applyCustomTemplateAction(templateId: string): Promise<ApplyTemplateResult> {
  let session;
  try { session = await requireHeadMentor(); } catch (e: any) { return { success: false, error: e.message }; }

  if (!await findTeamTemplate(templateId, session.user.teamId!)) return { success: false, error: "Template not found." };
  const tasks = await prisma.templateTask.findMany({ where: { templateId } });
  return applyToActiveSeason(session.user.teamId!, session.user.id, tasks);
}

export async function applyStandardTemplateAction(): Promise<ApplyTemplateResult> {
  let session;
  try { session = await requireHeadMentor(); } catch (e: any) { return { success: false, error: e.message }; }

  return applyToActiveSeason(session.user.teamId!, session.user.id, STANDARD_TASKS.map((t) => ({
    ...t,
    subTeam:      t.subTeam as SubTeam | null,
    priority:     t.priority as TaskPriority,
    anchorNumber: t.anchorNumber ?? null,
  })));
}

export async function importTemplateTasksAction(
  templateId: string,
  tasks: {
    name: string;
    description: string;
    subTeam: string | null;
    startOffset: number;
    durationBuildDays: number;
    priority: string;
    estimatedHours: number | null;
    isMilestone: boolean;
    designReviewRequired: boolean;
    prerequisiteNames: string[];
    anchor?: TaskAnchor | null;
    anchorNumber?: number | null;
  }[]
): Promise<{ success: boolean; error?: string; count?: number }> {
  let session;
  try { session = await requireMentor(); } catch (e: any) { return { success: false, error: e.message }; }

  if (!tasks.length) return { success: false, error: "No tasks to import." };

  const template = await findTeamTemplate(templateId, session.user.teamId!);
  if (!template) return { success: false, error: "Template not found." };

  await prisma.templateTask.createMany({
    data: tasks.map((t) => ({
      templateId,
      name:                 t.name,
      description:          t.description || null,
      subTeam:              (t.subTeam as SubTeam) || null,
      startOffset:          t.startOffset,
      durationBuildDays:    t.durationBuildDays,
      priority:             t.priority as TaskPriority,
      estimatedHours:       t.estimatedHours,
      isMilestone:          t.isMilestone,
      designReviewRequired: t.designReviewRequired,
      prerequisiteNames:    t.prerequisiteNames,
      anchor:               t.anchor && (TASK_ANCHORS as readonly string[]).includes(t.anchor) ? t.anchor : legacyAnchor(t.startOffset),
      anchorNumber:         t.anchorNumber ?? null,
    })),
  });

  revalidatePath(`/tasks/templates/${templateId}`);
  revalidatePath("/tasks/templates");
  return { success: true, count: tasks.length };
}

export async function clearAllTasksAction(): Promise<{ success: boolean; error?: string }> {
  // Deletes every task in the season — previously open to any team member
  let session;
  try { session = await requireHeadMentor(); } catch (e: any) { return { success: false, error: e.message }; }

  const activeSeason = await prisma.season.findFirst({
    where: { teamId: session.user.teamId, isActive: true },
  });
  if (!activeSeason) return { success: false, error: "No active season." };

  await prisma.task.deleteMany({ where: { seasonId: activeSeason.id } });
  revalidatePath("/tasks");
  return { success: true };
}

