import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { competitionCountdown } from "@/lib/competition";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { daysBetween, isOverdue, SUBTEAM_OPTIONS } from "@/lib/schedule-helpers";
import { getActiveRobotId } from "@/app/actions/robot-context";
import { TasksTabBar } from "./TasksTabBar";
import { KanbanView } from "./KanbanView";
import { ListView } from "./ListView";
import { SeasonProgressBar } from "./SeasonProgressBar";
import { PageHeader } from "@/components/PageHeader";

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; mine?: string; task?: string }>;
}) {
  // ?task=<id> opens that task's card (links to /tasks/<id> land here)
  const { view = "kanban", mine, task: openTaskId } = await searchParams;
  const showMineOnly = mine !== "0";
  const session = await auth();
  if (!session?.user?.teamId) redirect("/dashboard");

  const canEdit = session.user.roles.some((r) =>
    ["HEAD_MENTOR", "BUILD_LEAD"].includes(r)
  );

  const [activeSeason, activeRobotId] = await Promise.all([
    prisma.season.findFirst({
      where:   { teamId: session.user.teamId, isActive: true },
      include: { competitionEvents: { select: { name: true, stage: true, stageNumber: true, startDate: true, endDate: true } } },
    }),
    getActiveRobotId(),
  ]);

  if (!activeSeason) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-h1 text-(--color-text-primary) mb-4">Tasks</h1>
        <div className="card">
          <p className="text-body text-(--color-text-secondary)">
            No active season.{" "}
            <Link href="/settings/season" className="text-(--color-secondary) hover:underline">
              Set up a season
            </Link>{" "}
            first.
          </p>
        </div>
      </div>
    );
  }

  const now = new Date();
  const kickoff = activeSeason.startDate; // the season's span, start to end
  const end = activeSeason.endDate;
  const daysToEnd = daysBetween(now, end);
  const totalBuildDays = daysBetween(kickoff, end);
  const nextComp = competitionCountdown(activeSeason.competitionEvents, now);
  const elapsed = daysBetween(kickoff, now);
  const buildProgress = Math.round(Math.min(Math.max((elapsed / totalBuildDays) * 100, 0), 100));

  // Full task fetch for all views + modal data
  const taskInclude = {
    assignees:     { select: { id: true, name: true } },
    prerequisites: { select: { id: true, name: true, status: true } },
    dependents:    { select: { id: true, name: true, status: true, autoSchedule: true } },
    robot:         { select: { id: true, displayName: true } },
  } as const;
  const tasks = await prisma.task.findMany({
    where: {
      seasonId: activeSeason.id,
      ...(activeRobotId ? { OR: [{ robotId: activeRobotId }, { robotId: null }] } : {}),
      ...(showMineOnly ? { assignees: { some: { id: session.user.id } } } : {}),
    },
    include: taskInclude,
    orderBy: [{ priority: "asc" }, { dueDate: "asc" }],
  });

  const [allMembers, allRobots] = await Promise.all([
    prisma.user.findMany({
      where: { teamId: session.user.teamId, status: "ACTIVE" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.robot.findMany({
      where: { season: { teamId: session.user.teamId, isActive: true }, archived: false },
      select: { id: true, displayName: true },
    }),
  ]);

  // Serialize for client components
  const serialize = (t: (typeof tasks)[number]) => ({
    id:                   t.id,
    name:                 t.name,
    details:              t.details,
    status:               t.status,
    priority:             t.priority,
    subTeam:              t.subTeam,
    startDate:            t.startDate?.toISOString() ?? null,
    dueDate:              t.dueDate?.toISOString() ?? null,
    autoSchedule:         t.autoSchedule,
    durationDays:         t.durationDays,
    lagDays:              t.lagDays,
    estimatedHours:       t.estimatedHours,
    actualHours:          t.actualHours,
    isMilestone:          t.isMilestone,
    designReviewRequired: t.designReviewRequired,
    designReviewStatus:   t.designReviewStatus,
    blockersNotes:        t.blockersNotes,
    completionDate:       t.completionDate?.toISOString() ?? null,
    assignees:            t.assignees,
    prerequisites:        t.prerequisites,
    dependents:           t.dependents,
    robot:                t.robot,
  });
  const serializedTasks = tasks.map(serialize);

  // The task to open: from the list, or loaded on its own when the filters hide it
  const openTask = openTaskId
    ? serializedTasks.find((t) => t.id === openTaskId)
      ?? await prisma.task.findFirst({ where: { id: openTaskId, seasonId: activeSeason.id }, include: taskInclude }).then((t) => (t ? serialize(t) : null))
    : null;

  // Every task in the season (not just the ones shown), for picking prerequisites and
  // working out dates from them
  const allTasksLite = (await prisma.task.findMany({
    where:   { seasonId: activeSeason.id },
    select:  { id: true, name: true, status: true, dueDate: true },
    orderBy: { name: "asc" },
  })).map((t) => ({ id: t.id, name: t.name, status: t.status, dueDate: t.dueDate?.toISOString() ?? null }));

  // Progress stats — always the whole season (ignores My tasks / robot filters) so the
  // header card is identical on the Kanban, List and Gantt views
  const allTaskStats = await prisma.task.findMany({
    where:  { seasonId: activeSeason.id },
    select: { status: true, subTeam: true },
  });
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

  const kickoffStr = activeSeason.startDate.toISOString().split("T")[0];
  const endStr     = activeSeason.endDate.toISOString().split("T")[0];

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">

      {/* Page header */}
      <PageHeader
        title="Tasks"
        help="tasks"
        subtitle={<>
          {activeSeason.name}
          {activeRobotId && (
            <span className="ml-2 badge badge-info">Robot filtered</span>
          )}
        </>}
        actions={<>
          {canEdit && (
            <Link href="/tasks/templates">
              <Button variant="outline" size="sm">Templates</Button>
            </Link>
          )}
          <Link href="/tasks/new">
            <Button size="sm">+ New task</Button>
          </Link>
        </>}
      />

      {/* Season progress bar */}
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

      {/* Tab bar */}
      <TasksTabBar />

      {/* View content */}
      {view === "list" ? (
        <ListView
          tasks={serializedTasks}
          allTasks={allTasksLite}
          allMembers={allMembers}
          allRobots={allRobots}
          kickoffDate={kickoffStr}
          endDate={endStr}
          openTask={openTask}
        />
      ) : (
        <KanbanView
          tasks={serializedTasks}
          allTasks={allTasksLite}
          allMembers={allMembers}
          allRobots={allRobots}
          kickoffDate={kickoffStr}
          endDate={endStr}
          canEdit={canEdit}
          openTask={openTask}
        />
      )}
    </div>
  );
}


