"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { TaskPriority, SubTeam } from "@/generated/prisma";

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

  revalidatePath("/schedule/templates");
  return { success: true, id: template.id };
}

export async function updateTemplateAction(
  templateId: string,
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  try { await requireMentor(); } catch (e: any) { return { success: false, error: e.message }; }

  await prisma.seasonTemplate.update({
    where: { id: templateId },
    data: {
      name: (formData.get("name") as string)?.trim(),
      description: (formData.get("description") as string) || null,
    },
  });

  revalidatePath(`/schedule/templates/${templateId}`);
  revalidatePath("/schedule/templates");
  return { success: true };
}

export async function deleteTemplateAction(templateId: string): Promise<{ success: boolean; error?: string }> {
  try { await requireMentor(); } catch (e: any) { return { success: false, error: e.message }; }
  await prisma.seasonTemplate.delete({ where: { id: templateId } });
  revalidatePath("/schedule/templates");
  return { success: true };
}

// ─── Template tasks ─────────────────────────────────────────────────────────

const TemplateTaskSchema = z.object({
  name:                 z.string().min(1),
  subTeam:              z.string().optional(),
  startOffset:          z.coerce.number().int(),        // positive=from kickoff, negative=from week0
  durationBuildDays:    z.coerce.number().int().min(1).default(1),
  priority:             z.enum(["CRITICAL","HIGH","MEDIUM","LOW"]).default("MEDIUM"),
  estimatedHours:       z.coerce.number().optional(),
  isMilestone:          z.coerce.boolean().optional(),
  designReviewRequired: z.coerce.boolean().optional(),
  description:          z.string().optional(),
});

export async function addTemplateTaskAction(
  templateId: string,
  _prev: { success: boolean; error?: string } | null,
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  try { await requireMentor(); } catch (e: any) { return { success: false, error: e.message }; }

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
  });
  if (!parsed.success) return { success: false, error: "Please fill in all required fields." };

  await prisma.templateTask.create({
    data: {
      templateId,
      name:                 parsed.data.name,
      subTeam:              (parsed.data.subTeam as SubTeam) || null,
      startOffset:          parsed.data.startOffset,
      durationBuildDays:    parsed.data.durationBuildDays,
      priority:             parsed.data.priority as TaskPriority,
      estimatedHours:       parsed.data.estimatedHours,
      isMilestone:          parsed.data.isMilestone ?? false,
      designReviewRequired: parsed.data.designReviewRequired ?? false,
      description:          parsed.data.description,
    },
  });

  revalidatePath(`/schedule/templates/${templateId}`);
  return { success: true };
}

export async function updateTemplateTaskAction(
  taskId: string,
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  try { await requireMentor(); } catch (e: any) { return { success: false, error: e.message }; }

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
  });
  if (!parsed.success) return { success: false, error: "Invalid data." };

  const task = await prisma.templateTask.findUnique({ where: { id: taskId }, select: { templateId: true } });
  await prisma.templateTask.update({
    where: { id: taskId },
    data: {
      name:                 parsed.data.name,
      subTeam:              (parsed.data.subTeam as SubTeam) || null,
      startOffset:          parsed.data.startOffset,
      durationBuildDays:    parsed.data.durationBuildDays,
      priority:             parsed.data.priority as TaskPriority,
      estimatedHours:       parsed.data.estimatedHours,
      isMilestone:          parsed.data.isMilestone ?? false,
      designReviewRequired: parsed.data.designReviewRequired ?? false,
      description:          parsed.data.description,
    },
  });

  if (task) revalidatePath(`/schedule/templates/${task.templateId}`);
  return { success: true };
}

export async function deleteTemplateTaskAction(taskId: string): Promise<{ success: boolean }> {
  try { await requireMentor(); } catch { return { success: false }; }
  const task = await prisma.templateTask.findUnique({ where: { id: taskId }, select: { templateId: true } });
  await prisma.templateTask.delete({ where: { id: taskId } });
  if (task) revalidatePath(`/schedule/templates/${task.templateId}`);
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
    where: { teamId: session.user.teamId, isActive: true },
  });
  if (!activeSeason) return { success: false, error: "No active season." };

  const tasks = await prisma.task.findMany({
    where: { seasonId: activeSeason.id },
    select: { name: true, subTeam: true, startDate: true, dueDate: true, priority: true,
              isMilestone: true, estimatedHours: true, designReviewRequired: true, description: true },
  });

  if (tasks.length === 0) return { success: false, error: "No tasks in the current season to save." };

  // Convert absolute dates to offsets relative to kickoff / week0
  const kickoff = activeSeason.kickoffDate.getTime();
  const week0   = activeSeason.week0Date.getTime();
  const DAY     = 86400000;

  const template = await prisma.seasonTemplate.create({
    data: {
      name: name.trim(),
      description: description || null,
      createdById: session.user.id,
      tasks: {
        create: tasks.map((t) => {
          const startMs = t.startDate ? t.startDate.getTime() : kickoff;
          const dueMs   = t.dueDate   ? t.dueDate.getTime()   : startMs + DAY;
          // Determine anchor: closer to week0 end gets negative offset
          const fromKickoff = Math.round((startMs - kickoff) / DAY);
          const fromWeek0   = Math.round((startMs - week0)   / DAY);
          const startOffset = Math.abs(fromWeek0) < Math.abs(fromKickoff) ? fromWeek0 : fromKickoff;
          const durationBuildDays = Math.max(1, Math.round((dueMs - startMs) / DAY));

          return {
            name:                 t.name,
            subTeam:              t.subTeam,
            startOffset,
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

  revalidatePath("/schedule/templates");
  return { success: true, id: template.id };
}

// ─── Apply a custom template ─────────────────────────────────────────────────

export async function applyCustomTemplateAction(
  templateId: string
): Promise<{ success: boolean; error?: string; count?: number }> {
  let session;
  try { session = await requireHeadMentor(); } catch (e: any) { return { success: false, error: e.message }; }

  const [template, activeSeason] = await Promise.all([
    prisma.seasonTemplate.findUnique({
      where: { id: templateId },
      include: { tasks: true },
    }),
    prisma.season.findFirst({ where: { teamId: session.user.teamId, isActive: true } }),
  ]);

  if (!template) return { success: false, error: "Template not found." };
  if (!activeSeason) return { success: false, error: "No active season." };

  const existing = new Set(
    (await prisma.task.findMany({ where: { seasonId: activeSeason.id }, select: { name: true } })).map((t) => t.name)
  );

  const toCreate = template.tasks.filter((t) => !existing.has(t.name));
  if (toCreate.length === 0) return { success: true, count: 0 };

  await prisma.task.createMany({
    data: toCreate.map((t) => {
      const startDate = resolveDate(t.startOffset, activeSeason.kickoffDate, activeSeason.week0Date);
      const dueDate   = new Date(startDate);
      dueDate.setDate(dueDate.getDate() + t.durationBuildDays);
      return {
        seasonId: activeSeason.id, createdById: session.user.id,
        name: t.name, subTeam: t.subTeam, description: t.description,
        startDate, dueDate, priority: t.priority,
        isMilestone: t.isMilestone, estimatedHours: t.estimatedHours,
        designReviewRequired: t.designReviewRequired,
        designReviewStatus: t.designReviewRequired ? "PENDING" : "NOT_REQUIRED",
      };
    }),
  });

  revalidatePath("/schedule");
  revalidatePath("/schedule/tasks");
  return { success: true, count: toCreate.length };
}

// Standard FRC build season milestones from the PRD
const STANDARD_MILESTONES = [
  { name: "Game Analysis Complete",                startOffset: 0,   durationBuildDays: 2,  isMilestone: true,  priority: "HIGH"     as TaskPriority, subTeam: "STRATEGY"    as SubTeam },
  { name: "Robot Strategy & Design Brief",         startOffset: 2,   durationBuildDays: 3,  isMilestone: true,  priority: "HIGH"     as TaskPriority, subTeam: "DESIGN"      as SubTeam },
  { name: "Subsystem Design Reviews Complete",     startOffset: 5,   durationBuildDays: 5,  isMilestone: true,  priority: "CRITICAL" as TaskPriority, subTeam: "MECHANICAL"  as SubTeam },
  { name: "Prototyping Complete",                  startOffset: 10,  durationBuildDays: 4,  isMilestone: true,  priority: "HIGH"     as TaskPriority, subTeam: "MECHANICAL"  as SubTeam },
  { name: "Full Robot CAD Complete",               startOffset: 14,  durationBuildDays: 4,  isMilestone: true,  priority: "HIGH"     as TaskPriority, subTeam: "DESIGN"      as SubTeam },
  { name: "Drivetrain Assembled & Driving",        startOffset: -21, durationBuildDays: 3,  isMilestone: true,  priority: "CRITICAL" as TaskPriority, subTeam: "MECHANICAL"  as SubTeam },
  { name: "All Subsystems Integrated",             startOffset: -14, durationBuildDays: 3,  isMilestone: true,  priority: "CRITICAL" as TaskPriority, subTeam: "MECHANICAL"  as SubTeam },
  { name: "Robot Driving with Full Functionality", startOffset: -10, durationBuildDays: 3,  isMilestone: true,  priority: "CRITICAL" as TaskPriority, subTeam: "PROGRAMMING" as SubTeam },
  { name: "Driver Practice Begins",               startOffset: -7,  durationBuildDays: 2,  isMilestone: true,  priority: "HIGH"     as TaskPriority, subTeam: "DRIVE_TEAM"  as SubTeam },
  { name: "Robot Weight Confirmed Under Limit",   startOffset: -5,  durationBuildDays: 1,  isMilestone: true,  priority: "HIGH"     as TaskPriority, subTeam: "MECHANICAL"  as SubTeam },
  { name: "BOM Complete & Reviewed",              startOffset: -3,  durationBuildDays: 1,  isMilestone: true,  priority: "HIGH"     as TaskPriority, subTeam: "OPERATIONS"  as SubTeam },
  { name: "Robot Documentation Package Complete", startOffset: -2,  durationBuildDays: 1,  isMilestone: true,  priority: "MEDIUM"   as TaskPriority, subTeam: "OPERATIONS"  as SubTeam },
  { name: "Week 0 — Robot Done",                  startOffset: 0,   durationBuildDays: 1,  isMilestone: true,  priority: "CRITICAL" as TaskPriority, subTeam: null },
  // Supporting tasks
  { name: "Kickoff Game Manual Review",            startOffset: 0,   durationBuildDays: 1,  isMilestone: false, priority: "CRITICAL" as TaskPriority, subTeam: "STRATEGY"    as SubTeam },
  { name: "Field Element Research",               startOffset: 0,   durationBuildDays: 2,  isMilestone: false, priority: "HIGH"     as TaskPriority, subTeam: "STRATEGY"    as SubTeam },
  { name: "Subsystem Assignments Finalized",      startOffset: 3,   durationBuildDays: 2,  isMilestone: false, priority: "HIGH"     as TaskPriority, subTeam: "OPERATIONS"  as SubTeam },
  { name: "Electrical System Design",             startOffset: 5,   durationBuildDays: 5,  isMilestone: false, priority: "HIGH"     as TaskPriority, subTeam: "ELECTRICAL"  as SubTeam },
  { name: "Robot Code Base Setup",                startOffset: 2,   durationBuildDays: 3,  isMilestone: false, priority: "HIGH"     as TaskPriority, subTeam: "PROGRAMMING" as SubTeam },
  { name: "Autonomous Routines Programmed",       startOffset: -14, durationBuildDays: 7,  isMilestone: false, priority: "CRITICAL" as TaskPriority, subTeam: "PROGRAMMING" as SubTeam },
  { name: "Competition Packing List Prepared",    startOffset: -5,  durationBuildDays: 2,  isMilestone: false, priority: "HIGH"     as TaskPriority, subTeam: "OPERATIONS"  as SubTeam },
  { name: "Bumper Construction",                  startOffset: -10, durationBuildDays: 3,  isMilestone: false, priority: "HIGH"     as TaskPriority, subTeam: "MECHANICAL"  as SubTeam },
];

/** Resolves a relative offset (positive = from kickoff, negative = from week0) to an absolute Date */
function resolveDate(offset: number, kickoff: Date, week0: Date): Date {
  const base = offset >= 0 ? new Date(kickoff) : new Date(week0);
  base.setDate(base.getDate() + offset);
  return base;
}

export async function applyStandardTemplateAction(): Promise<{ success: boolean; error?: string; count?: number }> {
  let session;
  try { session = await requireHeadMentor(); } catch (e: any) { return { success: false, error: e.message }; }

  const activeSeason = await prisma.season.findFirst({
    where: { teamId: session.user.teamId, isActive: true },
  });
  if (!activeSeason) return { success: false, error: "No active season." };

  // Get existing task names to avoid duplicates
  const existing = await prisma.task.findMany({
    where: { seasonId: activeSeason.id },
    select: { name: true },
  });
  const existingNames = new Set(existing.map((t) => t.name));

  const toCreate = STANDARD_MILESTONES.filter((m) => !existingNames.has(m.name));
  if (toCreate.length === 0) return { success: true, count: 0 };

  await prisma.task.createMany({
    data: toCreate.map((m) => {
      const startDate = resolveDate(m.startOffset, activeSeason.kickoffDate, activeSeason.week0Date);
      const dueDate   = new Date(startDate);
      dueDate.setDate(dueDate.getDate() + m.durationBuildDays);

      return {
        seasonId:    activeSeason.id,
        createdById: session.user.id,
        name:        m.name,
        subTeam:     m.subTeam,
        startDate,
        dueDate,
        isMilestone: m.isMilestone,
        priority:    m.priority,
      };
    }),
  });

  revalidatePath("/schedule");
  revalidatePath("/schedule/tasks");
  return { success: true, count: toCreate.length };
}

export async function clearAllTasksAction(): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.teamId) return { success: false, error: "Not authenticated." };

  const activeSeason = await prisma.season.findFirst({
    where: { teamId: session.user.teamId, isActive: true },
  });
  if (!activeSeason) return { success: false, error: "No active season." };

  await prisma.task.deleteMany({ where: { seasonId: activeSeason.id } });
  revalidatePath("/schedule");
  return { success: true };
}
