import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getActiveRobotId } from "@/app/actions/robot-context";
import { GanttClient } from "./GanttClient";

export default async function GanttPage({ searchParams }: { searchParams: Promise<{ subTeam?: string }> }) {
  const { subTeam } = await searchParams;
  const session = await auth();
  if (!session?.user?.teamId) redirect("/dashboard");

  const [activeSeason, activeRobotId] = await Promise.all([
    prisma.season.findFirst({ where: { teamId: session.user.teamId, isActive: true } }),
    getActiveRobotId(),
  ]);
  if (!activeSeason) redirect("/settings/season");

  const tasks = await prisma.task.findMany({
    where: {
      seasonId: activeSeason.id,
      ...(subTeam ? { subTeam: subTeam as any } : {}),
      ...(activeRobotId ? { OR: [{ robotId: activeRobotId }, { robotId: null }] } : {}),
      NOT: { startDate: null, dueDate: null },
    },
    include: { assignees: { select: { name: true } } },
    orderBy: [{ subTeam: "asc" }, { startDate: "asc" }],
  });

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

  return (
    <div className="max-w-full px-4 sm:px-6 lg:px-8 py-8 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <nav className="text-small text-[--color-text-secondary] mb-1">
            <Link href="/schedule" className="hover:text-[--color-primary]">Schedule</Link>
            <span className="mx-2">›</span>Gantt
          </nav>
          <h1 className="text-h1 text-[--color-text-primary]">Gantt chart</h1>
          <p className="text-body text-[--color-text-secondary] mt-1">
            {activeSeason.name} · {totalDays} days
            {activeRobotId && <span className="ml-2 badge badge-info">Robot filtered</span>}
          </p>
        </div>
        <Link href="/schedule/tasks/new"><Button size="sm">+ New task</Button></Link>
      </div>

      {ganttTasks.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-body text-[--color-text-secondary] mb-4">
            No tasks with dates yet. Tasks need a start and due date to appear on the Gantt.
          </p>
          <Link href="/schedule/tasks/new"><Button size="sm">Create task</Button></Link>
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
