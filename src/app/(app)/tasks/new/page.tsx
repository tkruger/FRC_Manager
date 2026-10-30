import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { isViewOnly } from "@/lib/access/read-only";
import { ViewOnlyNotice } from "@/components/access/ViewOnly";
import Link from "next/link";
import { NewTaskForm } from "./NewTaskForm";

export default async function NewTaskPage() {
  const session = await auth();
  if (!session?.user?.teamId) redirect("/dashboard");
  if (isViewOnly(session.user.roles)) return <ViewOnlyNotice what="New task" />;

  const activeSeason = await prisma.season.findFirst({
    where: { teamId: session.user.teamId, isActive: true },
    include: { robots: { where: { archived: false }, select: { id: true, displayName: true } } },
  });
  if (!activeSeason) redirect("/settings/season");

  const [members, existingTasks] = await Promise.all([
    prisma.user.findMany({
      where: { teamId: session.user.teamId, status: "ACTIVE" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.task.findMany({
      where: { seasonId: activeSeason.id },
      select: { id: true, name: true, status: true, dueDate: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <nav className="text-small text-(--color-text-secondary) mb-3">
        <Link href="/tasks" className="hover:text-(--color-primary)">Tasks</Link>
        <span className="mx-2">›</span>New task
      </nav>
      <h1 className="text-h1 text-(--color-text-primary) mb-6">New task</h1>
      <NewTaskForm
        robots={activeSeason.robots}
        members={members}
        existingTasks={existingTasks.map((t) => ({ ...t, dueDate: t.dueDate?.toISOString() ?? null }))}
        kickoffDate={activeSeason.startDate.toISOString().split("T")[0]}
        endDate={activeSeason.endDate.toISOString().split("T")[0]}
      />
    </div>
  );
}

