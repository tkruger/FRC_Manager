import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SUBTEAM_COLORS, STATUS_CONFIG, daysBetween, clamp } from "@/lib/schedule-helpers";

// Generate an array of dates between start and end (inclusive)
function dateRange(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  const cur = new Date(start);
  while (cur <= end) {
    days.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

function isBuildDay(date: Date, meetingDays: string[]): boolean {
  const MAP: Record<string, number> = { SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6 };
  return meetingDays.some((d) => MAP[d] === date.getDay());
}

export default async function GanttPage({ searchParams }: { searchParams: Promise<{ subTeam?: string }> }) {
  const { subTeam } = await searchParams;
  const session = await auth();
  if (!session?.user?.teamId) redirect("/dashboard");

  const activeSeason = await prisma.season.findFirst({
    where: { teamId: session.user.teamId, isActive: true },
  });
  if (!activeSeason) redirect("/settings/season");

  const tasks = await prisma.task.findMany({
    where: {
      seasonId: activeSeason.id,
      ...(subTeam ? { subTeam: subTeam as any } : {}),
      NOT: { startDate: null, dueDate: null },
    },
    include: { assignees: { select: { name: true } } },
    orderBy: [{ subTeam: "asc" }, { startDate: "asc" }],
  });

  const kickoff = activeSeason.kickoffDate;
  const week0   = activeSeason.week0Date;
  const totalDays = daysBetween(kickoff, week0) + 1;
  const days = dateRange(kickoff, week0);
  const today = new Date();
  const todayOffset = clamp(daysBetween(kickoff, today), 0, totalDays);

  // Group tasks by sub-team
  const groups: Record<string, typeof tasks> = {};
  for (const t of tasks) {
    const key = t.subTeam ?? "OTHER";
    if (!groups[key]) groups[key] = [];
    groups[key].push(t);
  }

  // Week boundaries for header
  const weeks: { label: string; start: number; width: number }[] = [];
  let weekStart = 0;
  for (let i = 0; i < days.length; i++) {
    if (days[i].getDay() === 1 || i === 0) {
      // Monday or first day
      if (weeks.length > 0) weeks[weeks.length - 1].width = i - weeks[weeks.length - 1].start;
      weeks.push({
        label: days[i].toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        start: i,
        width: 0,
      });
    }
  }
  if (weeks.length > 0) weeks[weeks.length - 1].width = days.length - weeks[weeks.length - 1].start;

  const COL_W = 28; // px per day

  return (
    <div className="max-w-full px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <nav className="text-small text-[--color-text-secondary] mb-1">
            <Link href="/schedule" className="hover:text-[--color-primary]">Schedule</Link>
            <span className="mx-2">›</span>Gantt
          </nav>
          <h1 className="text-h1 text-[--color-text-primary]">Gantt chart</h1>
          <p className="text-body text-[--color-text-secondary] mt-1">{activeSeason.name} · {totalDays} days</p>
        </div>
        <Link href="/schedule/tasks/new"><Button size="sm">+ New task</Button></Link>
      </div>

      {tasks.length === 0 && (
        <div className="card text-center py-12">
          <p className="text-body text-[--color-text-secondary] mb-4">
            No tasks with dates yet. Tasks need a start and due date to appear on the Gantt.
          </p>
          <Link href="/schedule/tasks/new"><Button size="sm">Create task</Button></Link>
        </div>
      )}

      {tasks.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-[--color-border]">
          <div style={{ minWidth: `${240 + totalDays * COL_W}px` }}>

            {/* Timeline header */}
            <div className="flex bg-[--color-surface-raised] border-b border-[--color-border]">
              {/* Task name column */}
              <div className="w-60 shrink-0 px-3 py-2 text-label font-medium text-[--color-text-secondary] border-r border-[--color-border]">
                Task
              </div>
              {/* Week headers */}
              <div className="flex-1 relative" style={{ height: 36 }}>
                {weeks.map((w, i) => (
                  <div
                    key={i}
                    className="absolute top-0 bottom-0 flex items-center px-2 text-label text-[--color-text-secondary] border-r border-[--color-border]"
                    style={{ left: w.start * COL_W, width: w.width * COL_W }}
                  >
                    {w.label}
                  </div>
                ))}
                {/* Today line in header */}
                {todayOffset >= 0 && todayOffset <= totalDays && (
                  <div className="absolute top-0 bottom-0 w-px bg-[--color-primary]"
                    style={{ left: todayOffset * COL_W }} />
                )}
              </div>
            </div>

            {/* Day grid background row (build day shading) */}
            {/* Rows by sub-team */}
            {Object.entries(groups).map(([subTeam, groupTasks]) => {
              const color = SUBTEAM_COLORS[subTeam] ?? "#64748B";
              return (
                <div key={subTeam}>
                  {/* Sub-team label row */}
                  <div className="flex bg-[--color-surface-overlay] border-b border-[--color-border]">
                    <div className="w-60 shrink-0 px-3 py-1.5 border-r border-[--color-border]">
                      <span className="text-label font-semibold" style={{ color }}>{subTeam.replace("_", " ")}</span>
                    </div>
                    <div className="flex-1 relative" style={{ height: 28 }}>
                      {/* Build day shading */}
                      {days.map((d, i) => !isBuildDay(d, activeSeason.meetingDays) && (
                        <div key={i} className="absolute top-0 bottom-0 bg-[--color-surface-overlay]/60"
                          style={{ left: i * COL_W, width: COL_W }} />
                      ))}
                      {/* Today line */}
                      {todayOffset >= 0 && todayOffset <= totalDays && (
                        <div className="absolute top-0 bottom-0 w-px bg-[--color-primary]/40"
                          style={{ left: todayOffset * COL_W }} />
                      )}
                    </div>
                  </div>

                  {/* Task rows */}
                  {groupTasks.map((task) => {
                    if (!task.startDate || !task.dueDate) return null;

                    const startOff = clamp(daysBetween(kickoff, task.startDate), 0, totalDays);
                    const endOff   = clamp(daysBetween(kickoff, task.dueDate),   0, totalDays);
                    const barWidth = Math.max(endOff - startOff, 1);
                    const isDone   = task.status === "COMPLETE";
                    const isBlocked = task.status === "BLOCKED";
                    const barColor = isBlocked ? "var(--color-danger)" : isDone ? "var(--color-success)" : color;

                    return (
                      <div key={task.id} className="flex border-b border-[--color-border] hover:bg-[--color-surface-raised] transition-colors group">
                        {/* Task name */}
                        <div className="w-60 shrink-0 px-3 py-2 border-r border-[--color-border] flex items-center gap-1.5">
                          {task.isMilestone && <span className="text-[--color-primary] text-xs shrink-0">◆</span>}
                          <Link href={`/schedule/tasks/${task.id}`}
                            className="text-small text-[--color-text-primary] hover:text-[--color-primary] truncate leading-tight">
                            {task.name}
                          </Link>
                        </div>

                        {/* Timeline */}
                        <div className="flex-1 relative py-2" style={{ height: 36 }}>
                          {/* Build day shading */}
                          {days.map((d, i) => !isBuildDay(d, activeSeason.meetingDays) && (
                            <div key={i} className="absolute top-0 bottom-0 bg-[--color-surface-overlay]/60"
                              style={{ left: i * COL_W, width: COL_W }} />
                          ))}

                          {/* Today line */}
                          {todayOffset >= 0 && todayOffset <= totalDays && (
                            <div className="absolute top-0 bottom-0 w-px bg-[--color-primary]/40"
                              style={{ left: todayOffset * COL_W }} />
                          )}

                          {/* Task bar */}
                          {task.isMilestone ? (
                            // Milestone diamond
                            <div
                              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rotate-45 border-2"
                              style={{ left: startOff * COL_W + COL_W / 2, backgroundColor: barColor, borderColor: barColor }}
                              title={task.name}
                            />
                          ) : (
                            <div
                              className="absolute top-1 bottom-1 rounded-sm flex items-center px-1.5 overflow-hidden"
                              style={{ left: startOff * COL_W, width: barWidth * COL_W, backgroundColor: barColor + "CC" }}
                              title={`${task.name} (${task.status})`}
                            >
                              <span className="text-white text-xs truncate font-medium leading-none opacity-90">
                                {task.name}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}

            {/* Week 0 marker */}
            <div className="flex bg-[--color-surface-raised] border-t border-[--color-border]">
              <div className="w-60 shrink-0 px-3 py-1.5 border-r border-[--color-border]">
                <span className="text-label font-semibold text-[--color-primary]">Week 0</span>
              </div>
              <div className="flex-1 relative" style={{ height: 28 }}>
                <div className="absolute top-0 bottom-0 w-0.5 bg-[--color-primary]"
                  style={{ left: (totalDays - 1) * COL_W }} />
                <span className="absolute top-1/2 -translate-y-1/2 text-label text-[--color-primary] font-bold"
                  style={{ left: (totalDays - 1) * COL_W + 4 }}>
                  Robot done
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-small text-[--color-text-secondary]">
        <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm bg-[--color-success]" />Complete</span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm bg-[--color-danger]" />Blocked</span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-px h-3 bg-[--color-primary]" />Today</span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 bg-[--color-surface-overlay]" />Non-build day</span>
        <span className="flex items-center gap-1.5">◆ Milestone</span>
      </div>
    </div>
  );
}
