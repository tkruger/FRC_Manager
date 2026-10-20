import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findTeamTemplate } from "@/lib/template-access";
import type { TimelineSeason, TimelineTask } from "@/lib/template-timeline";
import { TemplatePresentation } from "./TemplatePresentation";

/** Full-screen slides that walk people through a template (Templates → Present) */
export default async function PresentTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.teamId) redirect("/dashboard");

  const [template, tasks, season, team] = await Promise.all([
    findTeamTemplate(id, session.user.teamId),
    prisma.templateTask.findMany({ where: { templateId: id } }),
    prisma.season.findFirst({
      where:  { teamId: session.user.teamId, isActive: true },
      select: { name: true, kickoffDate: true, endDate: true, competitionEvents: { select: { name: true, stage: true, stageNumber: true, startDate: true } } },
    }),
    prisma.team.findUnique({ where: { id: session.user.teamId }, select: { teamNumber: true } }),
  ]);
  if (!template) notFound();

  const timelineTasks: TimelineTask[] = tasks.map((t) => ({
    id: t.id, name: t.name, subTeam: t.subTeam, priority: t.priority, isMilestone: t.isMilestone,
    anchor: t.anchor, anchorNumber: t.anchorNumber, startOffset: t.startOffset, durationBuildDays: t.durationBuildDays,
    estimatedHours: t.estimatedHours, designReviewRequired: t.designReviewRequired,
    prerequisiteNames: t.prerequisiteNames, description: t.description,
  }));
  const timelineSeason: TimelineSeason | null = season && {
    name:         season.name,
    kickoffDate:  season.kickoffDate.toISOString(),
    endDate:      season.endDate.toISOString(),
    competitions: season.competitionEvents.map((c) => ({ ...c, startDate: c.startDate.toISOString() })),
  };

  return (
    <TemplatePresentation
      templateId={id}
      name={template.name}
      description={template.description}
      teamNumber={team?.teamNumber ?? null}
      tasks={timelineTasks}
      season={timelineSeason}
    />
  );
}
