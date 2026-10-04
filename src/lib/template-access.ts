// Season templates have no teamId column — they belong to the team of the user who
// created them (the templates list is scoped the same way). Server-only.

import { prisma } from "@/lib/prisma";

/** The template if it belongs to `teamId`, otherwise null. */
export async function findTeamTemplate(templateId: string, teamId: string) {
  const template = await prisma.seasonTemplate.findUnique({ where: { id: templateId } });
  if (!template?.createdById) return null;
  const owner = await prisma.user.findFirst({
    where:  { id: template.createdById, teamId },
    select: { id: true },
  });
  return owner ? template : null;
}

/** The template a template task belongs to, if that template is the team's. */
export async function findTeamTemplateTask(taskId: string, teamId: string) {
  const task = await prisma.templateTask.findUnique({ where: { id: taskId }, select: { id: true, templateId: true } });
  if (!task) return null;
  return (await findTeamTemplate(task.templateId, teamId)) ? task : null;
}
