"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { findTeamTemplate, findTeamTemplateTask } from "@/lib/template-access";
import { STANDARD_TASKS } from "@/lib/standard-template";
import {
  TASK_ANCHORS, STAGE_INFO, isCompetitionAnchor, legacyAnchor, resolveAnchor, addDays, week0Date,
  type TaskAnchor, type SeasonDates,
} from "@/lib/competition";
import type { Prisma, TaskPriority, SubTeam } from "@/generated/prisma";
import { scheduleTemplate, wouldLoop, type EventTarget } from "@/lib/template-timeline";
import { ActionError, userMessage } from "@/lib/action-error";

const MENTOR_ROLES = ["HEAD_MENTOR", "BUILD_LEAD", "INVENTORY_ADMIN"] as const;

async function requireMentor() {
  const session = await auth();
  if (!session?.user?.teamId) throw new ActionError("Not authenticated.");
  if (!session.user.roles.some((r) => MENTOR_ROLES.includes(r as any)))
    throw new ActionError("Only mentors and build leads can manage templates.");
  return session;
}

async function requireHeadMentor() {
  const session = await auth();
  if (!session?.user?.teamId) throw new ActionError("Not authenticated.");
  if (!session.user.roles.includes("HEAD_MENTOR" as any))
    throw new ActionError("Only Head Mentors can apply templates to an active season.");
  return session;
}

// ─── Custom template CRUD ───────────────────────────────────────────────────

export async function createTemplateAction(
  _prev: { success: boolean; error?: string; id?: string } | null,
  formData: FormData
): Promise<{ success: boolean; error?: string; id?: string }> {
  let session;
  try { session = await requireMentor(); } catch (e) { return { success: false, error: userMessage(e) }; }

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
  try { session = await requireMentor(); } catch (e) { return { success: false, error: userMessage(e) }; }
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
  try { session = await requireMentor(); } catch (e) { return { success: false, error: userMessage(e) }; }
  if (!await findTeamTemplate(templateId, session.user.teamId!)) return { success: false, error: "Template not found." };
  await prisma.seasonTemplate.delete({ where: { id: templateId } });
  revalidatePath("/tasks/templates");
  return { success: true };
}

// ─── Template tasks ─────────────────────────────────────────────────────────

const TemplateTaskSchema = z.object({
  name:                 z.string().max(300).min(1),
  subTeam:              z.string().max(300).optional(),
  startOffset:          z.coerce.number().int().min(-730).max(730), // start: days before (−) / after (+) the anchor
  durationBuildDays:    z.coerce.number().int().min(0).max(365).default(1), // due = start + this; milestones use 0
  priority:             z.enum(["CRITICAL","HIGH","MEDIUM","LOW"]).default("MEDIUM"),
  estimatedHours:       z.coerce.number().optional(),
  isMilestone:          z.coerce.boolean().optional(),
  designReviewRequired: z.coerce.boolean().optional(),
  details:              z.string().max(20000).optional(),
  anchor:               z.enum(TASK_ANCHORS).optional(),
  anchorNumber:         z.coerce.number().int().min(0).max(99).optional(),
  anchorTaskName:       z.string().trim().max(300).optional(),
});

/** Reads a template-task form. Forms without an anchor fall back to the old sign rule. */
function parseTemplateTaskForm(formData: FormData) {
  const parsed = TemplateTaskSchema.safeParse({
    name:                 formData.get("name"),
    subTeam:              formData.get("subTeam") || undefined,
    startOffset:          formData.get("startOffset"),
    durationBuildDays:    formData.get("durationBuildDays") ?? 1,
    priority:             formData.get("priority") || "MEDIUM",
    estimatedHours:       formData.get("estimatedHours") || undefined,
    isMilestone:          formData.get("isMilestone") === "on",
    designReviewRequired: formData.get("designReviewRequired") === "on",
    details:              typeof formData.get("details") === "string" ? formData.get("details") : undefined,
    anchor:               formData.get("anchor") || undefined,
    anchorNumber:         formData.get("anchorNumber") || undefined,
    anchorTaskName:       formData.get("anchorTaskName") || undefined,
  });
  if (!parsed.success) return null;
  const d = parsed.data;
  const anchor: TaskAnchor = d.anchor ?? legacyAnchor(d.startOffset);
  // A number only means something for numbered competition types ("Week1"); none = each one
  const anchorNumber = isCompetitionAnchor(anchor) && STAGE_INFO[anchor].numbered ? d.anchorNumber ?? null : null;
  // Timed from another task: which one (by name, checked against the template on save)
  const anchorTaskName = anchor === "TASK" ? d.anchorTaskName || null : null;
  if (anchor === "TASK" && !anchorTaskName) return null;
  // Prerequisites ("|"-separated names); left out (undefined) keeps the ones a task has.
  // The task it's timed from is always one of them.
  const prereqRaw = formData.get("prerequisiteNames");
  let prerequisiteNames = typeof prereqRaw === "string"
    ? prereqRaw.split("|").map((n) => n.trim().slice(0, 200)).filter(Boolean).slice(0, 50)
    : undefined;
  if (prerequisiteNames && anchorTaskName && !prerequisiteNames.some((n) => n.toLowerCase() === anchorTaskName.toLowerCase())) {
    prerequisiteNames = [...prerequisiteNames, anchorTaskName];
  }
  return {
    prerequisiteNames,
    name:                 d.name,
    subTeam:              (d.subTeam as SubTeam) || null,
    startOffset:          d.startOffset,
    // Milestones are a single date (length 0); tasks take at least a day
    durationBuildDays:    d.isMilestone ? d.durationBuildDays : Math.max(1, d.durationBuildDays),
    priority:             d.priority as TaskPriority,
    estimatedHours:       d.estimatedHours,
    isMilestone:          d.isMilestone ?? false,
    designReviewRequired: d.designReviewRequired ?? false,
    // Present (even empty) → set or cleared; absent → left as it is
    details:              d.details === undefined ? undefined : d.details.replace(/\r\n?/g, "\n").trim() || null,
    anchor,
    anchorNumber: anchor === "TASK" ? null : anchorNumber,
    anchorTaskName,
  };
}

type TemplateTaskData = NonNullable<ReturnType<typeof parseTemplateTaskForm>>;

/**
 * Checks a task timed from another task: that task must be in the template (it's saved
 * with the template's spelling) and mustn't lead back to this one. Returns an error, or
 * null when it's fine.
 */
async function checkTaskAnchor(templateId: string, data: TemplateTaskData, selfId: string | null, oldName: string | null): Promise<string | null> {
  if (data.anchor !== "TASK" || !data.anchorTaskName) return null;
  const others = await prisma.templateTask.findMany({
    where:  { templateId, ...(selfId ? { id: { not: selfId } } : {}) },
    select: { name: true, anchor: true, anchorTaskName: true },
  });
  const target = others.find((o) => o.name.trim().toLowerCase() === data.anchorTaskName!.trim().toLowerCase());
  if (!target) return `“${data.anchorTaskName}” isn't in this template.`;
  if (target.name.trim().toLowerCase() === data.name.trim().toLowerCase()) return "A task can't be timed from itself.";
  data.anchorTaskName = target.name;
  // Others timed from this task (by its old name, before a rename) count as timed from the new name
  const chain = others.map((o) => (oldName && o.anchorTaskName?.trim().toLowerCase() === oldName.trim().toLowerCase() ? { ...o, anchorTaskName: data.name } : o));
  if (wouldLoop(chain, data.name, target.name)) return `“${target.name}” is already timed from this one, so this would go round in a loop.`;
  return null;
}

export async function addTemplateTaskAction(
  templateId: string,
  _prev: { success: boolean; error?: string } | null,
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  let session;
  try { session = await requireMentor(); } catch (e) { return { success: false, error: userMessage(e) }; }
  if (!await findTeamTemplate(templateId, session.user.teamId!)) return { success: false, error: "Template not found." };

  const data = parseTemplateTaskForm(formData);
  if (!data) return { success: false, error: "Please fill in all required fields." };
  const anchorError = await checkTaskAnchor(templateId, data, null, null);
  if (anchorError) return { success: false, error: anchorError };

  await prisma.templateTask.create({ data: { templateId, ...data, prerequisiteNames: data.prerequisiteNames ?? [] } });

  revalidatePath(`/tasks/templates/${templateId}`);
  return { success: true };
}

export async function updateTemplateTaskAction(
  taskId: string,
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  let session;
  try { session = await requireMentor(); } catch (e) { return { success: false, error: userMessage(e) }; }
  const task = await findTeamTemplateTask(taskId, session.user.teamId!);
  if (!task) return { success: false, error: "Task not found." };

  const data = parseTemplateTaskForm(formData);
  if (!data) return { success: false, error: "Invalid data." };
  const before = await prisma.templateTask.findUniqueOrThrow({ where: { id: taskId }, select: { name: true, prerequisiteNames: true } });
  const anchorError = await checkTaskAnchor(task.templateId, data, taskId, before.name);
  if (anchorError) return { success: false, error: anchorError };
  // An older form without the prerequisites list: keep them, plus the task it's timed from
  if (!data.prerequisiteNames && data.anchorTaskName && !before.prerequisiteNames.includes(data.anchorTaskName)) {
    data.prerequisiteNames = [...before.prerequisiteNames, data.anchorTaskName];
  }

  await prisma.$transaction(async (tx) => {
    await tx.templateTask.update({ where: { id: taskId }, data });
    // Renamed: tasks that follow it or list it as a prerequisite keep pointing at it
    if (before.name !== data.name) await renameReferences(tx, task.templateId, before.name, data.name);
  });

  revalidatePath(`/tasks/templates/${task.templateId}`);
  return { success: true };
}

export async function deleteTemplateTaskAction(taskId: string): Promise<{ success: boolean }> {
  let session;
  try { session = await requireMentor(); } catch { return { success: false }; }
  const task = await findTeamTemplateTask(taskId, session.user.teamId!);
  if (!task) return { success: false };
  const gone = await prisma.templateTask.findUniqueOrThrow({ where: { id: taskId } });
  await prisma.$transaction(async (tx) => {
    // Tasks timed from this one take over its timing, so their dates don't move:
    // they now count from what it counted from, shifted by when it was due
    const followers = await tx.templateTask.findMany({ where: { templateId: gone.templateId, anchor: "TASK", anchorTaskName: { equals: gone.name, mode: "insensitive" } } });
    for (const f of followers) {
      await tx.templateTask.update({
        where: { id: f.id },
        data: {
          anchor: gone.anchor, anchorNumber: gone.anchorNumber, anchorTaskName: gone.anchorTaskName,
          startOffset: f.startOffset + gone.startOffset + gone.durationBuildDays,
          // …and need what it was timed from instead of it
          prerequisiteNames: [...new Set([
            ...f.prerequisiteNames.filter((n) => n.toLowerCase() !== gone.name.toLowerCase()),
            ...(gone.anchor === "TASK" && gone.anchorTaskName ? [gone.anchorTaskName] : []),
          ])],
        },
      });
    }
    // …and nothing lists it as a prerequisite any more
    const listing = await tx.templateTask.findMany({ where: { templateId: gone.templateId, prerequisiteNames: { has: gone.name } } });
    for (const l of listing) {
      await tx.templateTask.update({ where: { id: l.id }, data: { prerequisiteNames: l.prerequisiteNames.filter((n) => n !== gone.name) } });
    }
    await tx.templateTask.delete({ where: { id: taskId } });
  });
  revalidatePath(`/tasks/templates/${task.templateId}`);
  return { success: true };
}

/** After a rename: the template's other tasks follow / list the task by its new name */
async function renameReferences(tx: Prisma.TransactionClient, templateId: string, from: string, to: string) {
  const key = from.trim().toLowerCase();
  const others = await tx.templateTask.findMany({ where: { templateId, NOT: { name: to } } });
  for (const o of others) {
    const follows = o.anchorTaskName?.trim().toLowerCase() === key;
    const listed  = o.prerequisiteNames.some((n) => n.trim().toLowerCase() === key);
    if (!follows && !listed) continue;
    await tx.templateTask.update({
      where: { id: o.id },
      data: {
        ...(follows ? { anchorTaskName: to } : {}),
        ...(listed ? { prerequisiteNames: o.prerequisiteNames.map((n) => (n.trim().toLowerCase() === key ? to : n)) } : {}),
      },
    });
  }
}

// ─── Save current season tasks as a template ───────────────────────────────

export async function saveSeasonAsTemplateAction(
  name: string,
  description?: string
): Promise<{ success: boolean; error?: string; id?: string }> {
  let session;
  try { session = await requireMentor(); } catch (e) { return { success: false, error: userMessage(e) }; }

  const activeSeason = await prisma.season.findFirst({
    where:   { teamId: session.user.teamId, isActive: true },
    include: { competitionEvents: { select: { stage: true, stageNumber: true, startDate: true } } },
  });
  if (!activeSeason) return { success: false, error: "No active season." };

  const tasks = await prisma.task.findMany({
    where: { seasonId: activeSeason.id },
    select: { name: true, subTeam: true, startDate: true, dueDate: true, priority: true,
              isMilestone: true, estimatedHours: true, designReviewRequired: true, details: true,
              prerequisites: { select: { name: true } } },
  });

  if (tasks.length === 0) return { success: false, error: "No tasks in the current season to save." };

  // Convert absolute dates to offsets from whichever season date is nearest:
  // kickoff, Week 0 (the week before Week 1 — see week0Date) or the season end
  const DAY = 86400000;
  const kickoff = activeSeason.kickoffDate.getTime();
  const week0   = week0Date({ kickoffDate: activeSeason.kickoffDate, competitions: activeSeason.competitionEvents }).date;
  const anchors: { anchor: TaskAnchor; ms: number }[] = [
    { anchor: "KICKOFF",      ms: kickoff },
    { anchor: "SEASON_WEEK0", ms: week0.getTime() },
    { anchor: "SEASON_END",   ms: activeSeason.endDate.getTime() },
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
            details:              t.details,
            prerequisiteNames:    t.prerequisites.map((p) => p.name),
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
  details?:             string | null;
  prerequisiteNames:    string[];
  anchorTaskName?:      string | null;
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

  // Place everything: events from the season's dates, then tasks timed from other tasks
  // (days from kickoff; calendar dates are UTC midnight)
  const kickoff = season.kickoffDate.getTime();
  const DAY = 86_400_000;
  const { placed, unplaced } = scheduleTemplate(tasks, (t): EventTarget[] =>
    resolveAnchor(t.anchor, t.anchorNumber, dates).map((r) => ({ day: Math.round((r.date.getTime() - kickoff) / DAY), suffix: r.suffix, estimated: false })));
  const skipped = unplaced.map((u) => u.task.name);
  const nameOf = (p: { task: ApplicableTask; suffix: string | null }) => (p.suffix ? `${p.task.name} — ${p.suffix}` : p.task.name);

  const rows: Prisma.TaskCreateManyInput[] = [];
  const created: typeof placed = [];
  for (const p of placed) {
    const t = p.task;
    const name = nameOf(p);
    if (existing.has(name)) continue;
    existing.add(name);
    created.push(p);
    rows.push({
      seasonId: season.id, createdById: userId,
      name, subTeam: t.subTeam, details: t.details ?? null,
      startDate: new Date(kickoff + p.start * DAY), dueDate: new Date(kickoff + p.due * DAY),
      priority: t.priority, isMilestone: t.isMilestone, estimatedHours: t.estimatedHours ?? null,
      designReviewRequired: t.designReviewRequired,
      designReviewStatus: t.designReviewRequired ? "PENDING" : "NOT_REQUIRED",
    });
  }

  if (rows.length) {
    await prisma.task.createMany({ data: rows });
    await linkPrerequisites(season.id, placed, created, nameOf);
  }
  revalidatePath("/tasks");
  return { success: true, count: rows.length, skipped };
}

/**
 * Turns the template's prerequisites (and the task each one is timed from) into real links
 * between the new tasks. A prerequisite that happens once per competition links to the same
 * competition's copy ("Adjust strategy — Week1" needs "Event — Week1"); a once-only task
 * that needs a per-competition one needs all of them. Names not in the template link to a
 * season task of that name, if there is one.
 */
async function linkPrerequisites<T extends ApplicableTask>(
  seasonId: string,
  placed: { task: T; suffix: string | null }[],
  created: { task: T; suffix: string | null }[],
  nameOf: (p: { task: T; suffix: string | null }) => string,
) {
  const key = (n: string) => n.trim().toLowerCase();
  const ids = new Map(
    (await prisma.task.findMany({ where: { seasonId }, select: { id: true, name: true } })).map((t) => [t.name, t.id]),
  );
  const copies = new Map<string, { task: T; suffix: string | null }[]>();
  for (const p of placed) copies.set(key(p.task.name), [...(copies.get(key(p.task.name)) ?? []), p]);

  const updates: Prisma.PrismaPromise<unknown>[] = [];
  for (const p of created) {
    const id = ids.get(nameOf(p));
    if (!id) continue;
    const wanted = new Set([...p.task.prerequisiteNames, ...(p.task.anchorTaskName ? [p.task.anchorTaskName] : [])].map(key));
    const prereqIds = new Set<string>();
    for (const w of wanted) {
      if (w === key(p.task.name)) continue;
      const of = copies.get(w);
      if (!of) {
        // Not in the template: an existing season task with that name
        const match = [...ids.entries()].find(([n]) => key(n) === w);
        if (match) prereqIds.add(match[1]);
        continue;
      }
      const same = of.filter((c) => c.suffix === p.suffix);
      const pick = same.length ? same : of.length === 1 || p.suffix == null ? of : [];
      for (const c of pick) { const pid = ids.get(nameOf(c)); if (pid && pid !== id) prereqIds.add(pid); }
    }
    if (prereqIds.size) {
      updates.push(prisma.task.update({ where: { id }, data: { prerequisites: { connect: [...prereqIds].map((pid) => ({ id: pid })) } } }));
    }
  }
  if (updates.length) await prisma.$transaction(updates);
}

export async function applyCustomTemplateAction(templateId: string): Promise<ApplyTemplateResult> {
  let session;
  try { session = await requireHeadMentor(); } catch (e) { return { success: false, error: userMessage(e) }; }

  if (!await findTeamTemplate(templateId, session.user.teamId!)) return { success: false, error: "Template not found." };
  const tasks = await prisma.templateTask.findMany({ where: { templateId } });
  return applyToActiveSeason(session.user.teamId!, session.user.id, tasks);
}

export async function applyStandardTemplateAction(): Promise<ApplyTemplateResult> {
  let session;
  try { session = await requireHeadMentor(); } catch (e) { return { success: false, error: userMessage(e) }; }

  return applyToActiveSeason(session.user.teamId!, session.user.id, STANDARD_TASKS.map((t) => ({
    ...t,
    anchorTaskName: t.anchorTaskName ?? null,
    subTeam:      t.subTeam as SubTeam | null,
    priority:     t.priority as TaskPriority,
    anchorNumber: t.anchorNumber ?? null,
  })));
}

export async function importTemplateTasksAction(
  templateId: string,
  tasks: {
    name: string;
    details: string | null;
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
    anchorTaskName?: string | null;
  }[]
): Promise<{ success: boolean; error?: string; count?: number }> {
  let session;
  try { session = await requireMentor(); } catch (e) { return { success: false, error: userMessage(e) }; }

  if (!tasks.length) return { success: false, error: "No tasks to import." };

  const template = await findTeamTemplate(templateId, session.user.teamId!);
  if (!template) return { success: false, error: "Template not found." };

  await prisma.templateTask.createMany({
    data: tasks.map((t) => ({
      templateId,
      name:                 t.name,
      details:              t.details?.trim().slice(0, 20000) || null,
      subTeam:              (t.subTeam as SubTeam) || null,
      startOffset:          t.startOffset,
      durationBuildDays:    t.durationBuildDays,
      priority:             t.priority as TaskPriority,
      estimatedHours:       t.estimatedHours,
      isMilestone:          t.isMilestone,
      designReviewRequired: t.designReviewRequired,
      prerequisiteNames:    t.prerequisiteNames,
      anchor:               t.anchor && (TASK_ANCHORS as readonly string[]).includes(t.anchor) ? t.anchor : legacyAnchor(t.startOffset),
      anchorNumber:         t.anchor === "TASK" ? null : t.anchorNumber ?? null,
      anchorTaskName:       t.anchor === "TASK" ? t.anchorTaskName?.trim().slice(0, 300) || null : null,
    })),
  });

  revalidatePath(`/tasks/templates/${templateId}`);
  revalidatePath("/tasks/templates");
  return { success: true, count: tasks.length };
}

export async function clearAllTasksAction(): Promise<{ success: boolean; error?: string }> {
  // Deletes every task in the season — previously open to any team member
  let session;
  try { session = await requireHeadMentor(); } catch (e) { return { success: false, error: userMessage(e) }; }

  const activeSeason = await prisma.season.findFirst({
    where: { teamId: session.user.teamId, isActive: true },
  });
  if (!activeSeason) return { success: false, error: "No active season." };

  await prisma.task.deleteMany({ where: { seasonId: activeSeason.id } });
  revalidatePath("/tasks");
  return { success: true };
}

