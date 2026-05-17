"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import type { TaskPriority, SubTeam } from "@/generated/prisma";

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
  const session = await auth();
  if (!session?.user?.teamId) return { success: false, error: "Not authenticated." };

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
