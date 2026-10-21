import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findTeamTemplate } from "@/lib/template-access";
import { tasksToCSV } from "@/lib/template-csv";
import { executionOrder } from "@/lib/template-timeline";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.teamId) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;
  if (!await findTeamTemplate(id, session.user.teamId)) return new Response("Not found", { status: 404 });
  const template = await prisma.seasonTemplate.findFirst({
    where: { id },
    include: { tasks: true },
  });
  if (!template) return new Response("Not found", { status: 404 });

  // Same order as the template page: milestones by due date, then tasks by start
  const { milestones, tasks } = executionOrder(template.tasks);
  const csv = tasksToCSV(
    [...milestones, ...tasks].map((t) => ({
      name:                 t.name,
      description:          t.description,
      subTeam:              t.subTeam,
      startOffset:          t.startOffset,
      durationBuildDays:    t.durationBuildDays,
      priority:             t.priority,
      estimatedHours:       t.estimatedHours,
      isMilestone:          t.isMilestone,
      designReviewRequired: t.designReviewRequired,
      prerequisiteNames:    t.prerequisiteNames,
      anchor:               t.anchor,
      anchorNumber:         t.anchorNumber,
    }))
  );

  const filename = `${template.name.replace(/[^a-z0-9]/gi, "_")}_tasks.csv`;
  return new Response(csv, {
    headers: {
      "Content-Type":        "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
