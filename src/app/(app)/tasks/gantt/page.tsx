import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getActiveRobotId } from "@/app/actions/robot-context";
import { GanttClient } from "./GanttClient";
import { TasksTabBar } from "../TasksTabBar";
import { SeasonProgressBar } from "../SeasonProgressBar";
import { daysBetween } from "@/lib/schedule-helpers";

export default async function GanttPage({ searchParams }: { searchParams: Promise<{ subTeam?: string }> }) {
  const { subTeam } = await searchParams;
  const session = await auth();
  if (!session?.user?.teamId) redirect("/dashboard");

  const [activeSeason, activeRobotId] = await Promise.all([
    prisma.season.findFirst({ where: { teamId: session.user.teamId, isActive: true } }),
    getActiveRobotId(),
  ]);
  if (!activeSeason) redirect("/settings/season");

  const [tasks, allTaskStats] = await Promise.all([
    prisma.task.findMany({
      where: {
        seasonId: activeSeason.id,
        ...(subTeam ? { subTeam: subTeam as any } : {}),
        ...(activeRobotId ? { OR: [{ robotId: activeRobotId }, { robotId: null }] } : {}),
        NOT: { startDate: null, dueDate: null },
      },
      include: { assignees: { select: { name: true } } },
      orderBy: [{ subTeam: "asc" }, { startDate: "asc" }],
    }),
    prisma.task.findMany({
      where: { seasonId: activeSeason.id },
      select: { status: true, subTeam: true },
    }),
  ]);

  const ganttTasks = tasks.map((t) => ({
    id:             t.id,
    name:           t.name,
    status:         t.status,
    priority:       t.priority,
    subTeam:        t.subTeam,
    startDate:      t.startDate!.toISOString(),
    dueDate:        t.dueDate!.toISOString(),
    isMilestone:    t.isMilestone,
    description:    t.description,
    blockersNotes:  t.blockersNotes,
    estimatedHours: t.estimatedHours,
    actualHours:    t.actualHours,
    assignees:      t.assignees,
  }));

  const totalDays = Math.round(
    (activeSeason.week0Date.getTime() - activeSeason.kickoffDate.getTime()) / 86_400_000
  ) + 1;

  const canEdit = session.user.roles.some((r) =>
    ["HEAD_MENTOR", "BUILD_LEAD"].includes(r)
  );

  const now = new Date();
  const daysToWeek0 = daysBetween(now, activeSeason.week0Date);
  const totalBuildDays = daysBetween(activeSeason.kickoffDate, activeSeason.week0Date);
  const elapsed = daysBetween(activeSeason.kickoffDate, now);
  const buildProgress = Math.round(Math.min(Math.max((elapsed / totalBuildDays) * 100, 0), 100));
  const totalTasks = allTaskStats.length;
  const completeTasks = allTaskStats.filter((t) => t.status === "COMPLETE").length;
  const subteamStats: Record<string, { total: number; done: number }> = {};
  for (const t of allTaskStats) {
    const st = t.subTeam ?? "OTHER";
    if (!subteamStats[st]) subteamStats[st] = { total: 0, done: 0 };
    subteamStats[st].total++;
    if (t.status === "COMPLETE") subteamStats[st].done++;
  }

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h1 text-[--color-text-primary]">Schedule</h1>
          <p className="text-body text-[--color-text-secondary] mt-0.5">
            {activeSeason.name}
            {activeRobotId && <span className="ml-2 badge badge-info">Robot filtered</span>}
          </p>
        </div>
      </div>

      <SeasonProgressBar
        kickoffDate={activeSeason.kickoffDate.toISOString()}
        week0Date={activeSeason.week0Date.toISOString()}
        daysToWeek0={daysToWeek0}
        buildProgress={buildProgress}
        totalTasks={totalTasks}
        completeTasks={completeTasks}
        subteamStats={subteamStats}
      />

      <TasksTabBar canEdit={canEdit} />

      {ganttTasks.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-body text-[--color-text-secondary] mb-4">
            No tasks with dates yet. Tasks need a start and due date to appear on the Gantt.
          </p>
          <Link href="/tasks/new"><Button size="sm">Create task</Button></Link>
        </div>
      ) : (
        <GanttClient
          tasks={ganttTasks}
          kickoffDate={activeSeason.kickoffDate.toISOString()}
          week0Date={activeSeason.week0Date.toISOString()}
          meetingDays={activeSeason.meetingDays}
          seasonName={activeSeason.name}
        />
      )}
    </div>
  );
}




