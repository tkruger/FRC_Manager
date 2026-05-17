import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { STATUS_CONFIG, PRIORITY_CONFIG, SUBTEAM_COLORS, isOverdue, daysBetween, shortDate } from "@/lib/schedule-helpers";
import { differenceInCalendarDays, startOfWeek, endOfWeek, isWithinInterval } from "date-fns";

export default async function ScheduleDashboard() {
  const session = await auth();
  if (!session?.user?.teamId) redirect("/dashboard");

  const activeSeason = await prisma.season.findFirst({
    where: { teamId: session.user.teamId, isActive: true },
  });

  if (!activeSeason) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-h1 text-[--color-text-primary] mb-4">Schedule</h1>
        <div className="card">
          <p className="text-body text-[--color-text-secondary]">
            No active season. <Link href="/settings/season" className="text-[--color-secondary] hover:underline">Set up a season</Link> first.
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

  const tasks = await prisma.task.findMany({
    where: { seasonId: activeSeason.id },
    include: { assignees: { select: { id: true, name: true } }, robot: { select: { displayName: true } } },
    orderBy: [{ priority: "asc" }, { dueDate: "asc" }],
  });

  // Derived lists
  const overdue     = tasks.filter((t) => isOverdue(t));
  const thisWeekStart = startOfWeek(now, { weekStartsOn: 1 });
  const thisWeekEnd   = endOfWeek(now, { weekStartsOn: 1 });
  const thisWeek    = tasks.filter(
    (t) => t.dueDate && isWithinInterval(t.dueDate, { start: thisWeekStart, end: thisWeekEnd }) && t.status !== "COMPLETE"
  );
  const upcomingMilestones = tasks
    .filter((t) => t.isMilestone && t.status !== "COMPLETE" && t.dueDate && t.dueDate >= now)
    .sort((a, b) => (a.dueDate?.getTime() ?? 0) - (b.dueDate?.getTime() ?? 0))
    .slice(0, 3);

  // Completion rate by sub-team
  const subteamStats: Record<string, { total: number; done: number }> = {};
  for (const t of tasks) {
    const st = t.subTeam ?? "OTHER";
    if (!subteamStats[st]) subteamStats[st] = { total: 0, done: 0 };
    subteamStats[st].total++;
    if (t.status === "COMPLETE") subteamStats[st].done++;
  }

  const totalTasks = tasks.length;
  const completeTasks = tasks.filter((t) => t.status === "COMPLETE").length;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-h1 text-[--color-text-primary]">Schedule</h1>
          <p className="text-body text-[--color-text-secondary] mt-1">{activeSeason.name}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/schedule/gantt"><Button variant="outline" size="sm">Gantt view</Button></Link>
          <Link href="/schedule/templates"><Button variant="outline" size="sm">Templates</Button></Link>
          <Link href="/schedule/tasks/new"><Button size="sm">+ New task</Button></Link>
        </div>
      </div>

      {/* Season progress bar */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-h3 text-[--color-text-primary]">Season progress</h2>
            <p className="text-small text-[--color-text-secondary] mt-0.5">
              Kickoff {shortDate(kickoff)} → Week 0 {shortDate(week0)}
              {daysToWeek0 >= 0
                ? ` · ${daysToWeek0} calendar days remaining`
                : ` · Week 0 was ${Math.abs(daysToWeek0)} days ago`}
            </p>
          </div>
          <div className="text-right">
            <p className="text-h2 text-[--color-text-primary]">{completeTasks}/{totalTasks}</p>
            <p className="text-small text-[--color-text-secondary]">tasks complete</p>
          </div>
        </div>
        {/* Timeline bar */}
        <div className="w-full h-3 rounded-full bg-[--color-surface-overlay] overflow-hidden">
          <div
            className="h-full rounded-full bg-[--color-primary] transition-all"
            style={{ width: `${buildProgress}%` }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-small text-[--color-text-secondary]">Kickoff</span>
          <span className="text-small text-[--color-text-secondary]">Week 0</span>
        </div>

        {/* Sub-team breakdown */}
        {Object.keys(subteamStats).length > 0 && (
          <div className="mt-4 pt-4 border-t border-[--color-border] grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Object.entries(subteamStats).map(([st, s]) => {
              const pct = s.total ? Math.round((s.done / s.total) * 100) : 0;
              const color = SUBTEAM_COLORS[st] ?? "#64748B";
              return (
                <div key={st}>
                  <div className="flex justify-between text-small mb-1">
                    <span style={{ color }} className="font-medium">{st.replace("_", " ")}</span>
                    <span className="text-[--color-text-secondary]">{s.done}/{s.total}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[--color-surface-overlay]">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3-column summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Overdue */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-h2 text-[--color-text-primary]">
              Overdue
              {overdue.length > 0 && (
                <span className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-[--color-danger] text-white text-xs font-bold">{overdue.length}</span>
              )}
            </h2>
            <Link href="/schedule/tasks?filter=overdue" className="text-small text-[--color-secondary] hover:underline">All</Link>
          </div>
          <div className="space-y-2">
            {overdue.length === 0 ? (
              <div className="card py-6 text-center text-small text-[--color-text-secondary]">No overdue tasks 🎉</div>
            ) : overdue.slice(0, 5).map((t) => (
              <TaskCard key={t.id} task={t} showDue />
            ))}
          </div>
        </div>

        {/* This week */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-h2 text-[--color-text-primary]">Due this week</h2>
            <Link href="/schedule/tasks?filter=this-week" className="text-small text-[--color-secondary] hover:underline">All</Link>
          </div>
          <div className="space-y-2">
            {thisWeek.length === 0 ? (
              <div className="card py-6 text-center text-small text-[--color-text-secondary]">Nothing due this week</div>
            ) : thisWeek.slice(0, 5).map((t) => (
              <TaskCard key={t.id} task={t} showDue />
            ))}
          </div>
        </div>

        {/* Upcoming milestones */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-h2 text-[--color-text-primary]">Milestones</h2>
            <Link href="/schedule/tasks?filter=milestones" className="text-small text-[--color-secondary] hover:underline">All</Link>
          </div>
          <div className="space-y-2">
            {upcomingMilestones.length === 0 ? (
              <div className="card py-6 text-center text-small text-[--color-text-secondary]">No upcoming milestones</div>
            ) : upcomingMilestones.map((m) => {
              const daysLeft = m.dueDate ? differenceInCalendarDays(m.dueDate, now) : null;
              return (
                <Link key={m.id} href={`/schedule/tasks/${m.id}`} className="card flex items-center gap-3 hover:border-[--color-primary] transition-colors">
                  <span className="text-[--color-primary] text-lg" aria-hidden>◆</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[--color-text-primary] truncate">{m.name}</p>
                    <p className="text-small text-[--color-text-secondary]">
                      {shortDate(m.dueDate)}
                      {daysLeft !== null && ` · ${daysLeft}d away`}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {totalTasks === 0 && (
        <div className="card text-center py-12">
          <p className="text-body text-[--color-text-secondary] mb-4">No tasks yet. Start from a template or create tasks manually.</p>
          <div className="flex gap-3 justify-center">
            <Link href="/schedule/templates"><Button variant="outline">Apply template</Button></Link>
            <Link href="/schedule/tasks/new"><Button>Create first task</Button></Link>
          </div>
        </div>
      )}
    </div>
  );
}

function TaskCard({ task, showDue }: {
  task: { id: string; name: string; status: string; priority: string; dueDate: Date | null; subTeam: string | null; isMilestone: boolean };
  showDue?: boolean;
}) {
  const cfg = STATUS_CONFIG[task.status as keyof typeof STATUS_CONFIG];
  const color = SUBTEAM_COLORS[task.subTeam ?? ""] ?? "#64748B";
  const overdueFlag = isOverdue({ dueDate: task.dueDate, status: task.status as any });

  return (
    <Link href={`/schedule/tasks/${task.id}`}
      className="card flex items-center gap-3 hover:border-[--color-primary] transition-colors py-3"
      style={{ borderLeftColor: color, borderLeftWidth: "3px" }}>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[--color-text-primary] truncate">
          {task.isMilestone && <span className="text-[--color-primary] mr-1">◆</span>}
          {task.name}
        </p>
        {showDue && task.dueDate && (
          <p className={`text-small ${overdueFlag ? "text-[--color-danger] font-medium" : "text-[--color-text-secondary]"}`}>
            {overdueFlag ? "Overdue · " : "Due "}{shortDate(task.dueDate)}
          </p>
        )}
      </div>
      <Badge variant={cfg.variant}>{cfg.label}</Badge>
    </Link>
  );
}
