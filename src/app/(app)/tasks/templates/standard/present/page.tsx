import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { illustrativeSeason } from "@/lib/template-timeline";
import { standardTimelineTasks } from "@/lib/standard-template-view";
import { TemplatePresentation } from "../../[id]/present/TemplatePresentation";

/** Full-screen slides for the built-in standard template (Templates → Standard → Present) */
export default async function PresentStandardTemplatePage() {
  const session = await auth();
  if (!session?.user?.teamId) redirect("/dashboard");
  const team = await prisma.team.findUnique({ where: { id: session.user.teamId }, select: { teamNumber: true } });

  return (
    <TemplatePresentation
      templateId="standard"
      exitHref="/tasks/templates"
      name="Standard FRC season"
      description="The built-in template: kickoff and design, the build up to Week 0, each competition and the end of the season."
      teamNumber={team?.teamNumber ?? null}
      tasks={standardTimelineTasks()}
      season={illustrativeSeason()}
    />
  );
}
