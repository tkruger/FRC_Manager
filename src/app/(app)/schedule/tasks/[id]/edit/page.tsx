import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { EditTaskForm } from "./EditTaskForm";

export default async function EditTaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.teamId) redirect("/dashboard");

  const [task, activeSeason] = await Promise.all([
    prisma.task.findFirst({
      where: { id, season: { teamId: session.user.teamId } },
      include: {
        assignees:     { select: { id: true } },
        prerequisites: { select: { id: true } },
        robot:         { select: { id: true } },
      },
    }),
    prisma.season.findFirst({
      where: { teamId: session.user.teamId, isActive: true },
      include: { robots: { where: { archived: false }, select: { id: true, displayName: true } } },
    }),
  ]);

  if (!task) notFound();
  if (!activeSeason) redirect("/settings/season");

  const [members, allTasks] = await Promise.all([
    prisma.user.findMany({
      where: { teamId: session.user.teamId, status: "ACTIVE" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.task.findMany({
      where: { seasonId: task.seasonId, id: { not: id } },
      select: { id: true, name: true, status: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <nav className="text-small text-[--color-text-secondary] mb-3">
        <Link href="/schedule" className="hover:text-[--color-primary]">Schedule</Link>
        <span className="mx-2">›</span>
        <Link href="/schedule/tasks" className="hover:text-[--color-primary]">Tasks</Link>
        <span className="mx-2">›</span>
        <Link href={`/schedule/tasks/${id}`} className="hover:text-[--color-primary]">{task.name}</Link>
        <span className="mx-2">›</span>Edit
      </nav>
      <h1 className="text-h1 text-[--color-text-primary] mb-6">Edit task</h1>
      <EditTaskForm
        task={task}
        robots={activeSeason.robots}
        members={members}
        existingTasks={allTasks}
        kickoffDate={activeSeason.kickoffDate.toISOString().split("T")[0]}
        week0Date={activeSeason.week0Date.toISOString().split("T")[0]}
      />
    </div>
  );
}
