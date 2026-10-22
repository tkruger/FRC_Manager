// Tasks scheduled from their prerequisites (Task.autoSchedule). Server-only.
//
// An auto-scheduled task starts lagDays after its last prerequisite is due and takes
// durationDays (milestones: none). Whenever a task's dates change, everything downstream
// that's auto-scheduled is worked out again, in dependency order.

import { prisma } from "@/lib/prisma";

const DAY = 86_400_000;

/** Start and due for an auto-scheduled task, from its prerequisites' due dates (null: none have one) */
export function datesAfter(prereqDues: (Date | null)[], lagDays: number, durationDays: number | null, isMilestone: boolean): { start: Date; due: Date } | null {
  const dues = prereqDues.filter((d): d is Date => d != null).map((d) => d.getTime());
  if (!dues.length) return null;
  const start = Math.max(...dues) + lagDays * DAY;
  const length = isMilestone ? 0 : Math.max(1, durationDays ?? 1);
  // Counting both ends: a 4-day task starting Thursday is due Sunday
  return { start: new Date(start), due: new Date(start + Math.max(0, length - 1) * DAY) };
}

/**
 * Recalculates the auto-scheduled tasks that come after `changedIds` (and those tasks
 * themselves, if they're auto-scheduled). Finished tasks keep their dates. Tasks that depend
 * on each other in a loop are left as they are. Returns how many tasks got new dates.
 */
export async function rescheduleAfter(seasonId: string, changedIds: string[]): Promise<number> {
  if (!changedIds.length) return 0;
  const tasks = await prisma.task.findMany({
    where:  { seasonId },
    select: {
      id: true, status: true, isMilestone: true, autoSchedule: true, durationDays: true, lagDays: true,
      startDate: true, dueDate: true, prerequisites: { select: { id: true } },
    },
  });
  const byId = new Map(tasks.map((t) => [t.id, { ...t, prereqs: t.prerequisites.map((p) => p.id) }]));
  const dependents = new Map<string, string[]>();
  for (const t of byId.values()) for (const p of t.prereqs) dependents.set(p, [...(dependents.get(p) ?? []), t.id]);

  // Everything downstream of the change
  const affected = new Set<string>();
  const queue = [...changedIds];
  for (const id of changedIds) if (byId.get(id)?.autoSchedule) affected.add(id);
  while (queue.length) {
    for (const d of dependents.get(queue.shift()!) ?? []) {
      if (!affected.has(d)) { affected.add(d); queue.push(d); }
    }
  }
  const toPlace = [...affected].filter((id) => { const t = byId.get(id)!; return t.autoSchedule && t.status !== "COMPLETE"; });

  // Dependency order: a task is placed once none of its prerequisites still waits
  const waiting = new Set(toPlace);
  const updates: { id: string; startDate: Date; dueDate: Date }[] = [];
  for (let progress = true; progress && waiting.size; ) {
    progress = false;
    for (const id of [...waiting]) {
      const t = byId.get(id)!;
      if (t.prereqs.some((p) => waiting.has(p))) continue;
      waiting.delete(id);
      progress = true;
      const dates = datesAfter(t.prereqs.map((p) => byId.get(p)?.dueDate ?? null), t.lagDays, t.durationDays, t.isMilestone);
      if (!dates) continue;
      if (t.startDate?.getTime() !== dates.start.getTime() || t.dueDate?.getTime() !== dates.due.getTime()) {
        updates.push({ id, startDate: dates.start, dueDate: dates.due });
      }
      // Later tasks see the new dates
      t.startDate = dates.start;
      t.dueDate = dates.due;
    }
  }

  if (updates.length) {
    await prisma.$transaction(updates.map((u) => prisma.task.update({ where: { id: u.id }, data: { startDate: u.startDate, dueDate: u.dueDate } })));
  }
  return updates.length;
}
