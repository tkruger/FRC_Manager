import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { tasksToCSV } from "@/lib/template-csv";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.teamId) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;
  const template = await prisma.seasonTemplate.findFirst({
    where: { id },
    include: { tasks: { orderBy: { startOffset: "asc" } } },
  });
  if (!template) return new Response("Not found", { status: 404 });

  const csv = tasksToCSV(
    template.tasks.map((t) => ({
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
