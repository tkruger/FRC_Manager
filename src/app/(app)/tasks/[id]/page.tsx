import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** A task's link: opens the Tasks page with its card (all tasks, so it's on the board) */
export default async function TaskLinkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.teamId) redirect("/dashboard");
  const task = await prisma.task.findFirst({ where: { id, season: { teamId: session.user.teamId } }, select: { id: true } });
  if (!task) notFound();
  redirect(`/tasks?mine=0&task=${encodeURIComponent(task.id)}`);
}
