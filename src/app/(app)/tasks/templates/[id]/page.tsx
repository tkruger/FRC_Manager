import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { SUBTEAM_OPTIONS, PRIORITY_OPTIONS } from "@/lib/schedule-helpers";
import { AddTaskForm } from "./AddTaskForm";
import { EditTaskRow } from "./EditTaskRow";
import { DeleteTaskButton } from "./DeleteTaskButton";
import { RenameTemplateForm } from "./RenameTemplateForm";
import { TemplateCSVImport } from "@/app/(app)/tasks/templates/TemplateCSVImport";
import { Button } from "@/components/ui/button";

const MENTOR_ROLES = ["HEAD_MENTOR", "BUILD_LEAD", "INVENTORY_ADMIN"];

function offsetLabel(offset: number): string {
  if (offset >= 0) return `Kickoff + ${offset}d`;
  return `Week 0 − ${Math.abs(offset)}d`;
}

export default async function TemplateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.teamId) redirect("/dashboard");

  const isMentor = session.user.roles.some((r) => MENTOR_ROLES.includes(r));

  const [template, tasks] = await Promise.all([
    prisma.seasonTemplate.findUnique({ where: { id } }),
    prisma.templateTask.findMany({ where: { templateId: id }, orderBy: { startOffset: "asc" } }),
  ]);

  if (!template) notFound();

  const creator = template.createdById
    ? await prisma.user.findUnique({ where: { id: template.createdById }, select: { name: true } })
    : null;

  const milestones = tasks.filter((t) => t.isMilestone);
  const regular    = tasks.filter((t) => !t.isMilestone);

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
          <a href={`/api/templates/${id}/csv`} download>
            <Button variant="outline" size="sm">Download CSV</Button>
          </a>
          {isMentor && <TemplateCSVImport templateId={id} />}
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
          <AddTaskForm templateId={id} />
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
              <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                <span className="text-[--color-primary] text-xs shrink-0">◆</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[--color-text-primary] truncate">{t.name}</p>
                  {t.description && <p className="text-small text-[--color-text-secondary] truncate">{t.description}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {t.subTeam && <Badge variant="neutral">{t.subTeam.replace(/_/g, " ")}</Badge>}
                  <span className="text-small text-[--color-text-secondary] font-mono w-28 text-right">{offsetLabel(t.startOffset)}</span>
                  <span className="text-small text-[--color-text-disabled] w-14 text-right">{t.durationBuildDays}d</span>
                  {isMentor && (
                    <div className="flex gap-1">
                      <EditTaskRow task={t} />
                      <DeleteTaskButton taskId={t.id} />
                    </div>
                  )}
                </div>
              </div>
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
              <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[--color-text-primary] truncate">{t.name}</p>
                  {t.description && <p className="text-small text-[--color-text-secondary] truncate">{t.description}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {t.subTeam && <Badge variant="neutral">{t.subTeam.replace(/_/g, " ")}</Badge>}
                  <Badge variant={t.priority === "CRITICAL" ? "danger" : t.priority === "HIGH" ? "warning" : "neutral"}>
                    {t.priority}
                  </Badge>
                  <span className="text-small text-[--color-text-secondary] font-mono w-28 text-right">{offsetLabel(t.startOffset)}</span>
                  <span className="text-small text-[--color-text-disabled] w-14 text-right">{t.durationBuildDays}d</span>
                  {isMentor && (
                    <div className="flex gap-1">
                      <EditTaskRow task={t} />
                      <DeleteTaskButton taskId={t.id} />
                    </div>
                  )}
                </div>
              </div>
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
