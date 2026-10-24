import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ApplyTemplateButton } from "./ApplyTemplateButton";
import { NewTemplateDialog } from "./NewTemplateDialog";
import { SaveSeasonDialog } from "./SaveSeasonDialog";
import { DeleteTemplateButton } from "./DeleteTemplateButton";
import { ApplyCustomTemplateButton } from "./ApplyCustomTemplateButton";
import { shortDate } from "@/lib/schedule-helpers";
import { PageHeader } from "@/components/PageHeader";
import { describeAnchor, dueOffsetOf, kickoffOf } from "@/lib/competition";
import { executionOrder } from "@/lib/template-timeline";
import { standardTimelineTasks } from "@/lib/standard-template-view";
import { SUBTEAM_OPTIONS } from "@/lib/schedule-helpers";

const MENTOR_ROLES = ["HEAD_MENTOR", "BUILD_LEAD", "INVENTORY_ADMIN"];

// The standard template's milestones (in the order they happen) and how many tasks it has
const standard = executionOrder(standardTimelineTasks());
const STANDARD_MILESTONES = standard.milestones.map((m) => ({
  name:   m.name,
  offset: describeAnchor(m.anchor, m.anchorNumber, dueOffsetOf(m), m.anchorTaskName),
  team:   SUBTEAM_OPTIONS.find((o) => o.value === m.subTeam)?.label ?? "All",
}));
const STANDARD_TASK_COUNT = standard.tasks.length;

export default async function TemplatesPage() {
  const session = await auth();
  if (!session?.user?.teamId) redirect("/dashboard");

  const isMentor      = session.user.roles.some((r) => MENTOR_ROLES.includes(r));
  const isHeadMentor  = session.user.roles.includes("HEAD_MENTOR" as any);

  const teamUserIds = (await prisma.user.findMany({
    where: { teamId: session.user.teamId },
    select: { id: true },
  })).map((u) => u.id);

  const [activeSeason, customTemplates] = await Promise.all([
    prisma.season.findFirst({ where: { teamId: session.user.teamId, isActive: true } }),
    prisma.seasonTemplate.findMany({
      where: { createdById: { in: teamUserIds } },
      include: { tasks: { select: { id: true, isMilestone: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const taskCount = activeSeason
    ? await prisma.task.count({ where: { seasonId: activeSeason.id } })
    : 0;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <PageHeader
        title="Season templates"
        help="templates"
        breadcrumb={<>
          <Link href="/tasks" className="hover:text-(--color-primary)">Tasks</Link>
          <span className="mx-2">›</span>Templates
        </>}
        subtitle="Apply a task template to instantly populate your build season schedule."
        actions={<>
          <a href="/api/templates/empty" download>
            <Button variant="outline" size="sm">Download blank CSV</Button>
          </a>
          {isMentor && (
            <>
              {activeSeason && taskCount > 0 && <SaveSeasonDialog />}
              <NewTemplateDialog />
            </>
          )}
        </>}
      />

      {/* Custom templates */}
      {customTemplates.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-h2 text-(--color-text-primary)">Your templates</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {customTemplates.map((t) => {
              const milestoneCount = t.tasks.filter((tk) => tk.isMilestone).length;
              return (
                <div key={t.id} className="card flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="text-h3 text-(--color-text-primary) truncate">{t.name}</h3>
                      {t.description && (
                        <p className="text-small text-(--color-text-secondary) mt-0.5 truncate">{t.description}</p>
                      )}
                    </div>
                    {isMentor && <DeleteTemplateButton templateId={t.id} templateName={t.name} />}
                  </div>
                  <div className="flex items-center gap-2 text-small text-(--color-text-secondary)">
                    <span>{t.tasks.length} tasks</span>
                    {milestoneCount > 0 && <><span>·</span><span>{milestoneCount} milestones</span></>}
                  </div>
                  <div className="flex flex-wrap gap-2 mt-auto pt-2 border-t border-(--color-border)">
                    {isHeadMentor && <ApplyCustomTemplateButton templateId={t.id} disabled={!activeSeason} />}
                    {isMentor && (
                      <Link href={`/tasks/templates/${t.id}`}>
                        <Button variant="outline" size="sm">Edit tasks</Button>
                      </Link>
                    )}
                    <a href={`/api/templates/${t.id}/csv`} download>
                      <Button variant="outline" size="sm">Download CSV</Button>
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Standard FRC template */}
      <section className="space-y-4">
        <h2 className="text-h2 text-(--color-text-primary)">Standard FRC template</h2>
        <div className="card space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-h3 text-(--color-text-primary)">Standard FRC season</h3>
              <p className="text-body text-(--color-text-secondary) mt-1">
                {STANDARD_MILESTONES.length} milestones and {STANDARD_TASK_COUNT} tasks from kickoff to the end of the season,
                anchored to your kickoff, Week 0, competitions and season end — some follow other tasks. Missing tasks are added; existing tasks are never overwritten.
              </p>
              {activeSeason && (
                <p className="text-small text-(--color-text-secondary) mt-2">
                  Kickoff: <strong>{shortDate(kickoffOf(activeSeason))}</strong>{!activeSeason.kickoffDate && " (season start — set the kickoff in Season settings)"} · Ends: <strong>{shortDate(activeSeason.endDate)}</strong>
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <Link href="/tasks/templates/standard/present">
                <Button variant="outline" size="sm">▶ Present</Button>
              </Link>
              <a href="/api/templates/standard/csv" download>
                <Button variant="outline" size="sm">Download CSV</Button>
              </a>
              {isHeadMentor && <ApplyTemplateButton disabled={!activeSeason} existingTaskCount={taskCount} />}
            </div>
          </div>

          <div className="border border-(--color-border) rounded-md overflow-hidden">
            <div className="bg-(--color-surface-raised) px-4 py-2 border-b border-(--color-border)">
              <p className="text-label font-medium text-(--color-text-secondary)">Milestones included</p>
            </div>
            <div className="divide-y divide-(--color-border)">
              {STANDARD_MILESTONES.map((m) => (
                <div key={m.name} className="flex items-center justify-between px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-(--color-primary) text-xs">◆</span>
                    <span className="text-sm text-(--color-text-primary)">{m.name}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <Badge variant="neutral">{m.team}</Badge>
                    <span className="text-small text-(--color-text-secondary)">{m.offset}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

