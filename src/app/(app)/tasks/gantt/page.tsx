import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { competitionCountdown, designation, week0Date } from "@/lib/competition";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getActiveRobotId } from "@/app/actions/robot-context";
import { GanttClient } from "./GanttClient";
import { TasksTabBar } from "../TasksTabBar";
import { SeasonProgressBar } from "../SeasonProgressBar";
import { daysBetween, SUBTEAM_OPTIONS } from "@/lib/schedule-helpers";
import { PageHeader } from "@/components/PageHeader";
import { kickoffOf } from "@/lib/competition";

export default async function GanttPage({ searchParams }: { searchParams: Promise<{ subTeam?: string; mine?: string }> }) {
  const { subTeam, mine } = await searchParams;
  const showMineOnly = mine !== "0";
  const session = await auth();
  if (!session?.user?.teamId) redirect("/dashboard");

  const [activeSeason, activeRobotId] = await Promise.all([
    prisma.season.findFirst({
      where:   { teamId: session.user.teamId, isActive: true },
      include: { competitionEvents: { select: { name: true, stage: true, stageNumber: true, startDate: true, endDate: true } } },
    }),
    getActiveRobotId(),
  ]);
  if (!activeSeason) redirect("/settings/season");

  const [tasks, allTaskStats] = await Promise.all([
    prisma.task.findMany({
      where: {
        seasonId: activeSeason.id,
        ...(subTeam ? { subTeam: subTeam as any } : {}),
        ...(activeRobotId ? { OR: [{ robotId: activeRobotId }, { robotId: null }] } : {}),
        NOT: { startDate: null, dueDate: null }, // at least one date
        ...(showMineOnly ? { assignees: { some: { id: session.user.id } } } : {}),
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
    // A task with only one date sits on that day (the query skips ones with neither)
    startDate:      (t.startDate ?? t.dueDate)!.toISOString(),
    dueDate:        (t.dueDate ?? t.startDate)!.toISOString(),
    isMilestone:    t.isMilestone,
    details:        t.details,
    blockersNotes:  t.blockersNotes,
    estimatedHours: t.estimatedHours,
    actualHours:    t.actualHours,
    assignees:      t.assignees,
  }));

  // Key dates drawn as lines on the chart (days from kickoff): kickoff, Week 0 (the week
  // before Week 1 — its own event, or worked out), each competition and the season's end
  const DAY = 86_400_000;
  // Days from the season's start (the chart's day 0); the kickoff line is where kickoff falls
  const dayOf = (d: Date) => Math.round((d.getTime() - activeSeason.startDate.getTime()) / DAY);
  const kickoff = kickoffOf(activeSeason);
  const week0 = week0Date({ kickoffDate: kickoff, competitions: activeSeason.competitionEvents });
  const markers = [
    { day: dayOf(kickoff), label: "Kickoff", kind: "kickoff" as const },
    ...activeSeason.competitionEvents.map((c) => {
      const isWeek0 = c.stage === "WEEK" && c.stageNumber === 0;
      return { day: dayOf(c.startDate), label: isWeek0 ? "Week 0" : designation(c.stage, c.stageNumber), kind: isWeek0 ? "week0" as const : "competition" as const };
    }),
    ...(week0.source === "event" ? [] : [{ day: dayOf(week0.date), label: week0.source === "estimate" ? "Week 0 (est.)" : "Week 0", kind: "week0" as const }]),
    { day: dayOf(activeSeason.endDate), label: "Season end", kind: "end" as const },
  ].sort((a, b) => a.day - b.day);

  const totalDays = Math.round(
    (activeSeason.endDate.getTime() - activeSeason.startDate.getTime()) / 86_400_000
  ) + 1;

  const canEdit = session.user.roles.some((r) =>
    ["HEAD_MENTOR", "BUILD_LEAD"].includes(r)
  );

  const now = new Date();
  const daysToEnd = daysBetween(now, activeSeason.endDate);
  const nextComp = competitionCountdown(activeSeason.competitionEvents, now);
  const totalBuildDays = daysBetween(activeSeason.startDate, activeSeason.endDate);
  const elapsed = daysBetween(activeSeason.startDate, now);
  const buildProgress = Math.round(Math.min(Math.max((elapsed / totalBuildDays) * 100, 0), 100));
  const totalTasks = allTaskStats.length;
  const completeTasks = allTaskStats.filter((t) => t.status === "COMPLETE").length;
  const subteamStats: Record<string, { total: number; done: number }> = {};
  for (const opt of SUBTEAM_OPTIONS) {
    subteamStats[opt.value] = { total: 0, done: 0 };
  }
  for (const t of allTaskStats) {
    const st = t.subTeam ?? "OTHER";
    if (!subteamStats[st]) subteamStats[st] = { total: 0, done: 0 };
    subteamStats[st].total++;
    if (t.status === "COMPLETE") subteamStats[st].done++;
  }

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
      {/* Header */}
      <PageHeader
        title="Tasks"
        help="tasks"
        subtitle={<>
          {activeSeason.name}
          {activeRobotId && <span className="ml-2 badge badge-info">Robot filtered</span>}
        </>}
      />

      <SeasonProgressBar
        kickoffDate={activeSeason.startDate.toISOString()}
        endDate={activeSeason.endDate.toISOString()}
        daysToEnd={daysToEnd}
        nextCompetition={nextComp}
        buildProgress={buildProgress}
        totalTasks={totalTasks}
        completeTasks={completeTasks}
        subteamStats={subteamStats}
      />

      <TasksTabBar />

      {ganttTasks.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-body text-(--color-text-secondary) mb-4">
            No tasks with dates yet. Tasks need a start and due date to appear on the Gantt.
          </p>
          <Link href="/tasks/new"><Button size="sm">Create task</Button></Link>
        </div>
      ) : (
        <GanttClient
          tasks={ganttTasks}
          kickoffDate={activeSeason.startDate.toISOString()}
          endDate={activeSeason.endDate.toISOString()}
          seasonName={activeSeason.name}
          markers={markers}
        />
      )}
    </div>
  );
}






