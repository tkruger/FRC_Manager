import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { SUBTEAM_COLORS, shortDate, daysBetween, isOverdue } from "@/lib/schedule-helpers";
import { differenceInCalendarDays, startOfWeek, endOfWeek, isWithinInterval } from "date-fns";
import { getActiveRobotId } from "@/app/actions/robot-context";
import { ScheduleTabBar } from "./ScheduleTabBar";
import { KanbanView } from "./KanbanView";
import { ListView } from "./ListView";

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view = "kanban" } = await searchParams;
  const session = await auth();
  if (!session?.user?.teamId) redirect("/dashboard");

  const canEdit = session.user.roles.some((r) =>
    ["HEAD_MENTOR", "BUILD_LEAD"].includes(r)
  );

  const [activeSeason, activeRobotId] = await Promise.all([
    prisma.season.findFirst({ where: { teamId: session.user.teamId, isActive: true } }),
    getActiveRobotId(),
  ]);

  if (!activeSeason) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-h1 text-[--color-text-primary] mb-4">Schedule</h1>
        <div className="card">
          <p className="text-body text-[--color-text-secondary]">
            No active season.{" "}
            <Link href="/settings/season" className="text-[--color-secondary] hover:underline">
              Set up a season
            </Link>{" "}
            first.
          </p>
        </div>
      </div>
    );
  }

  const now = new Date();
  const kickoff = activeSeason.kickoffDate;
  const week0 = activeSeason.week0Date;
  const daysToWeek0 = daysBetween(now, week0);
  const totalBuildDays = daysBetween(kickoff, week0);
  const elapsed = daysBetween(kickoff, now);
  const buildProgress = Math.round(Math.min(Math.max((elapsed / totalBuildDays) * 100, 0), 100));

  // Full task fetch for all views + modal data
  const tasks = await prisma.task.findMany({
    where: {
      seasonId: activeSeason.id,
      ...(activeRobotId ? { OR: [{ robotId: activeRobotId }, { robotId: null }] } : {}),
    },
    include: {
      assignees:     { select: { id: true, name: true } },
      prerequisites: { select: { id: true, name: true, status: true } },
      dependents:    { select: { id: true, name: true, status: true } },
      robot:         { select: { id: true, displayName: true } },
    },
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
  const serializedTasks = tasks.map((t) => ({
    id:                   t.id,
    name:                 t.name,
    description:          t.description,
    status:               t.status,
    priority:             t.priority,
    subTeam:              t.subTeam,
    startDate:            t.startDate?.toISOString() ?? null,
    dueDate:              t.dueDate?.toISOString() ?? null,
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
  }));

  const allTasksLite = serializedTasks.map((t) => ({
    id: t.id, name: t.name, status: t.status,
  }));

  // Progress stats
  const totalTasks = tasks.length;
  const completeTasks = tasks.filter((t) => t.status === "COMPLETE").length;

  const subteamStats: Record<string, { total: number; done: number }> = {};
  for (const t of tasks) {
    const st = t.subTeam ?? "OTHER";
    if (!subteamStats[st]) subteamStats[st] = { total: 0, done: 0 };
    subteamStats[st].total++;
    if (t.status === "COMPLETE") subteamStats[st].done++;
  }

  const kickoffStr = activeSeason.kickoffDate.toISOString().split("T")[0];
  const week0Str   = activeSeason.week0Date.toISOString().split("T")[0];

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">

      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-h1 text-[--color-text-primary]">Schedule</h1>
          <p className="text-body text-[--color-text-secondary] mt-0.5">
            {activeSeason.name}
            {activeRobotId && (
              <span className="ml-2 badge badge-info">Robot filtered</span>
            )}
          </p>
        </div>
      </div>

      {/* Season progress bar */}
      <div className="card py-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-small text-[--color-text-secondary]">
              Kickoff {shortDate(kickoff)} → Week 0 {shortDate(week0)}
              {daysToWeek0 >= 0
                ? ` · ${daysToWeek0} days remaining`
                : ` · Week 0 was ${Math.abs(daysToWeek0)} days ago`}
            </p>
          </div>
          <div className="text-right">
            <p className="text-h3 text-[--color-text-primary]">{completeTasks}/{totalTasks}</p>
            <p className="text-small text-[--color-text-secondary]">tasks complete</p>
          </div>
        </div>
        <div className="w-full h-2 rounded-full bg-[--color-surface-overlay] overflow-hidden">
          <div
            className="h-full rounded-full bg-[--color-primary] transition-all"
            style={{ width: `${buildProgress}%` }}
          />
        </div>

        {Object.keys(subteamStats).length > 0 && (
          <div className="mt-3 pt-3 border-t border-[--color-border] grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            {Object.entries(subteamStats).map(([st, s]) => {
              const pct = s.total ? Math.round((s.done / s.total) * 100) : 0;
              const color = SUBTEAM_COLORS[st] ?? "#64748B";
              return (
                <div key={st}>
                  <div className="flex justify-between text-small mb-1">
                    <span style={{ color }} className="font-medium truncate">{st.replace("_", " ")}</span>
                    <span className="text-[--color-text-secondary] shrink-0 ml-1">{s.done}/{s.total}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[--color-surface-overlay]">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, backgroundColor: color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Tab bar */}
      <ScheduleTabBar canEdit={canEdit} />

      {/* View content */}
      {view === "list" ? (
        <ListView
          tasks={serializedTasks}
          allTasks={allTasksLite}
          allMembers={allMembers}
          allRobots={allRobots}
          kickoffDate={kickoffStr}
          week0Date={week0Str}
        />
      ) : (
        <KanbanView
          tasks={serializedTasks}
          allTasks={allTasksLite}
          allMembers={allMembers}
          allRobots={allRobots}
          kickoffDate={kickoffStr}
          week0Date={week0Str}
          canEdit={canEdit}
        />
      )}
    </div>
  );
}
