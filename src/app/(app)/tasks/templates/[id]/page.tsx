import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findTeamTemplate } from "@/lib/template-access";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { describeAnchor, isCompetitionAnchor, STAGE_INFO } from "@/lib/competition";
import type { SeasonPreview } from "./TaskTimingFields";
import { buildTimeline, illustrativeSeason, ruleText } from "@/lib/template-timeline";
import { HoverDetails, type HoverDetail } from "@/components/HoverDetails";
import { HelpLink } from "@/components/HelpLink";
import { Badge } from "@/components/ui/badge";
import { SUBTEAM_OPTIONS, PRIORITY_OPTIONS, SUBTEAM_COLORS } from "@/lib/schedule-helpers";
import { AddTaskForm } from "./AddTaskForm";
import { EditTaskRow } from "./EditTaskRow";
import { DeleteTaskButton } from "./DeleteTaskButton";
import { RenameTemplateForm } from "./RenameTemplateForm";
import { TemplateCSVImport } from "@/app/(app)/tasks/templates/TemplateCSVImport";
import { Button } from "@/components/ui/button";

const MENTOR_ROLES = ["HEAD_MENTOR", "BUILD_LEAD", "INVENTORY_ADMIN"];

export default async function TemplateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.teamId) redirect("/dashboard");

  const isMentor = session.user.roles.some((r) => MENTOR_ROLES.includes(r));

  const [template, tasks, activeSeason] = await Promise.all([
    findTeamTemplate(id, session.user.teamId),
    prisma.templateTask.findMany({ where: { templateId: id }, orderBy: { startOffset: "asc" } }),
    // Real dates for the add/edit preview
    prisma.season.findFirst({
      where:  { teamId: session.user.teamId, isActive: true },
      select: { name: true, kickoffDate: true, endDate: true, competitionEvents: { select: { name: true, stage: true, stageNumber: true, startDate: true } } },
    }),
  ]);
  const season: SeasonPreview | null = activeSeason && {
    name:         activeSeason.name,
    kickoffDate:  activeSeason.kickoffDate.toISOString(),
    endDate:      activeSeason.endDate.toISOString(),
    competitions: activeSeason.competitionEvents.map((c) => ({ ...c, startDate: c.startDate.toISOString() })),
  };
  /** "Due 3d before Week 0" — the due date is the start plus the length */
  const due = (t: { anchor: Parameters<typeof describeAnchor>[0]; anchorNumber: number | null; startOffset: number; durationBuildDays: number }) =>
    `Due ${describeAnchor(t.anchor, t.anchorNumber, t.startOffset + t.durationBuildDays).replace(/^On /, "on ")}`;

  if (!template) notFound();

  const creator = template.createdById
    ? await prisma.user.findUnique({ where: { id: template.createdById }, select: { name: true } })
    : null;

  // Order of execution: place every task on the example season (the same one the
  // presentation uses) so tasks counted from different dates compare properly.
  // Tasks go by start, milestones by due; "each competition" tasks use their first one.
  const when = new Map<string, { start: number; due: number }>();
  for (const it of buildTimeline(tasks.map((t) => ({
    id: t.id, name: t.name, subTeam: t.subTeam, priority: t.priority, isMilestone: t.isMilestone,
    anchor: t.anchor, anchorNumber: t.anchorNumber, startOffset: t.startOffset, durationBuildDays: t.durationBuildDays,
    estimatedHours: t.estimatedHours, designReviewRequired: t.designReviewRequired,
    prerequisiteNames: t.prerequisiteNames, description: t.description,
  })), illustrativeSeason()).items) {
    const prev = when.get(it.taskId);
    if (!prev || it.start < prev.start) when.set(it.taskId, { start: it.start, due: it.due });
  }
  const at = (id: string) => when.get(id) ?? { start: 0, due: 0 };

  // Hover card for each row: everything about it, with dates in the example season
  const example = illustrativeSeason();
  const exampleDay = (day: number) => new Date(new Date(example.kickoffDate).getTime() + day * 86_400_000)
    .toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
  const detail = (t: (typeof tasks)[number]): HoverDetail => {
    const len = t.durationBuildDays;
    const w = at(t.id);
    const each = isCompetitionAnchor(t.anchor) && STAGE_INFO[t.anchor].numbered && t.anchorNumber == null;
    return {
      title: `${t.isMilestone ? "◆ " : ""}${t.name}`,
      lines: [
        { label: "Sub-team", value: SUBTEAM_OPTIONS.find((o) => o.value === t.subTeam)?.label ?? "No sub-team", dot: t.subTeam ? SUBTEAM_COLORS[t.subTeam] : "#94A3B8" },
        { label: "Type", value: t.isMilestone ? "Milestone" : `Task · ${len} day${len === 1 ? "" : "s"} of work` },
        { label: "Due", value: ruleText(t.anchor, t.anchorNumber, t.startOffset + len) },
        ...(t.isMilestone ? [] : [{ label: "Starts", value: ruleText(t.anchor, t.anchorNumber, t.startOffset) }]),
        { label: "Example", value: `${t.isMilestone ? "" : `${exampleDay(w.start)} → `}${exampleDay(w.due)}${each ? " (first event; one per event)" : ""}` },
        { label: "Priority", value: PRIORITY_OPTIONS.find((o) => o.value === t.priority)?.label ?? t.priority },
        ...(t.estimatedHours != null ? [{ label: "Hours", value: `${t.estimatedHours} estimated` }] : []),
        ...(t.designReviewRequired ? [{ label: "Review", value: "Design review required" }] : []),
        ...(t.prerequisiteNames.length ? [{ label: "After", value: t.prerequisiteNames.join(", ") }] : []),
      ],
      note: t.description,
    };
  };
  const milestones = tasks.filter((t) => t.isMilestone)
    .sort((a, b) => at(a.id).due - at(b.id).due || a.name.localeCompare(b.name));
  const regular    = tasks.filter((t) => !t.isMilestone)
    .sort((a, b) => at(a.id).start - at(b.id).start || at(a.id).due - at(b.id).due || a.name.localeCompare(b.name));

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Breadcrumb */}
      <nav className="text-small text-[--color-text-secondary]">
        <Link href="/tasks" className="hover:text-[--color-primary]">Tasks</Link>
        <span className="mx-2">›</span>
        <Link href="/tasks/templates" className="hover:text-[--color-primary]">Templates</Link>
        <span className="mx-2">›</span>
        <span className="text-[--color-text-primary]">{template.name}</span>
      </nav>

      {/* Header */}
      <div className="space-y-3">
        {/* CSV tools */}
        <div className="flex flex-wrap gap-2">
          {tasks.length > 0 && (
            <Link href={`/tasks/templates/${id}/present`}>
              <Button size="sm">▶ Present</Button>
            </Link>
          )}
          <a href={`/api/templates/${id}/csv`} download>
            <Button variant="outline" size="sm">Download CSV</Button>
          </a>
          {isMentor && <TemplateCSVImport templateId={id} />}
          <span className="ml-auto"><HelpLink topic="templates" label="How templates work" /></span>
        </div>

        {isMentor
          ? <RenameTemplateForm templateId={id} currentName={template.name} currentDescription={template.description} />
          : (
            <div>
              <h1 className="text-h1 text-[--color-text-primary]">{template.name}</h1>
              {template.description && <p className="text-body text-[--color-text-secondary] mt-1">{template.description}</p>}
            </div>
          )
        }
        <p className="text-small text-[--color-text-secondary] mt-2">
          {tasks.length} tasks · Created by {creator?.name ?? "unknown"}
        </p>
      </div>

      {/* Add task form (mentors only) */}
      {isMentor && (
        <div className="card">
          <h2 className="text-h3 text-[--color-text-primary] mb-4">Add task</h2>
          <AddTaskForm templateId={id} season={season} />
        </div>
      )}

      {/* Milestones */}
      {milestones.length > 0 && (
        <section>
          <h2 className="text-h2 text-[--color-text-primary] mb-3">
            Milestones <span className="text-small font-normal text-[--color-text-secondary]">({milestones.length})</span>
          </h2>
          <div className="card divide-y divide-[--color-border] p-0 overflow-hidden">
            {milestones.map((t) => (
              <HoverDetails key={t.id} detail={detail(t)} className="flex items-center gap-3 px-4 py-3">
                <span className="text-[--color-primary] text-xs shrink-0">◆</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[--color-text-primary] truncate">{t.name}</p>
                  {t.description && <p className="text-small text-[--color-text-secondary] truncate">{t.description}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {t.subTeam && <Badge variant="neutral">{t.subTeam.replace(/_/g, " ")}</Badge>}
                  <span className="text-small text-(--color-text-secondary) w-40 sm:w-56 text-right">{due(t)}</span>
                  {isMentor && (
                    <div className="flex gap-1">
                      <EditTaskRow task={t} season={season} />
                      <EditTaskRow task={t} season={season} clone />
                      <DeleteTaskButton taskId={t.id} />
                    </div>
                  )}
                </div>
              </HoverDetails>
            ))}
          </div>
        </section>
      )}

      {/* Regular tasks */}
      {regular.length > 0 && (
        <section>
          <h2 className="text-h2 text-[--color-text-primary] mb-3">
            Tasks <span className="text-small font-normal text-[--color-text-secondary]">({regular.length})</span>
          </h2>
          <div className="card divide-y divide-[--color-border] p-0 overflow-hidden">
            {regular.map((t) => (
              <HoverDetails key={t.id} detail={detail(t)} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[--color-text-primary] truncate">{t.name}</p>
                  {t.description && <p className="text-small text-[--color-text-secondary] truncate">{t.description}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {t.subTeam && <Badge variant="neutral">{t.subTeam.replace(/_/g, " ")}</Badge>}
                  <Badge variant={t.priority === "CRITICAL" ? "danger" : t.priority === "HIGH" ? "warning" : "neutral"}>
                    {t.priority}
                  </Badge>
                  <span className="text-small text-(--color-text-secondary) w-40 sm:w-56 text-right">{due(t)}</span>
                  <span className="text-small text-(--color-text-disabled) w-14 text-right" title="Days of work">{t.durationBuildDays}d</span>
                  {isMentor && (
                    <div className="flex gap-1">
                      <EditTaskRow task={t} season={season} />
                      <EditTaskRow task={t} season={season} clone />
                      <DeleteTaskButton taskId={t.id} />
                    </div>
                  )}
                </div>
              </HoverDetails>
            ))}
          </div>
        </section>
      )}

      {tasks.length === 0 && (
        <div className="card text-center py-12">
          <p className="text-body text-[--color-text-secondary]">
            No tasks yet. {isMentor ? "Use the form above to add your first task." : "A mentor can add tasks to this template."}
          </p>
        </div>
      )}
    </div>
  );
}
