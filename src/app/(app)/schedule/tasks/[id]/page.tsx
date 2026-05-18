import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { STATUS_CONFIG, PRIORITY_CONFIG, SUBTEAM_COLORS, shortDate, isOverdue } from "@/lib/schedule-helpers";
import { TaskStatusButton } from "../TaskStatusButton";
import { DeleteTaskButton } from "./DeleteTaskButton";

export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.teamId) redirect("/dashboard");

  const task = await prisma.task.findFirst({
    where: { id, season: { teamId: session.user.teamId } },
    include: {
      assignees:    { select: { id: true, name: true } },
      prerequisites:{ select: { id: true, name: true, status: true, dueDate: true } },
      dependents:   { select: { id: true, name: true, status: true } },
      robot:        { select: { displayName: true } },
      createdBy:    { select: { name: true } },
      designReview: true,
    },
  });

  if (!task) notFound();

  const statusCfg   = STATUS_CONFIG[task.status];
  const priorityCfg = PRIORITY_CONFIG[task.priority];
  const stColor     = SUBTEAM_COLORS[task.subTeam ?? ""] ?? "#64748B";
  const overdue     = isOverdue(task);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Breadcrumb */}
      <nav className="text-small text-[--color-text-secondary]">
        <Link href="/schedule" className="hover:text-[--color-primary]">Schedule</Link>
        <span className="mx-2">›</span>
        <Link href="/schedule/tasks" className="hover:text-[--color-primary]">Tasks</Link>
        <span className="mx-2">›</span>
        <span className="text-[--color-text-primary]">{task.name}</span>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            {task.isMilestone && <span className="text-[--color-primary] text-xl">◆</span>}
            <h1 className="text-h1 text-[--color-text-primary]">{task.name}</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            {task.subTeam && <span className="text-sm font-medium" style={{ color: stColor }}>{task.subTeam.replace("_", " ")}</span>}
            <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
            <Badge variant={priorityCfg.variant}>{priorityCfg.label}</Badge>
            {overdue && <Badge variant="danger">Overdue</Badge>}
            {task.isMilestone && <Badge variant="info">Milestone</Badge>}
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <Link href={`/schedule/tasks/${id}/edit`}>
            <Button variant="outline" size="sm">Edit</Button>
          </Link>
          <DeleteTaskButton taskId={id} />
        </div>
      </div>

      {/* Status quick-change */}
      <div className="card flex items-center justify-between py-3">
        <p className="text-sm font-medium text-[--color-text-secondary]">Status</p>
        <TaskStatusButton taskId={task.id} currentStatus={task.status} />
      </div>

      {/* Meta grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Start",          value: shortDate(task.startDate) },
          { label: "Due",            value: shortDate(task.dueDate) },
          { label: "Est. hours",     value: task.estimatedHours != null ? `${task.estimatedHours}h` : "—" },
          { label: "Actual hours",   value: task.actualHours    != null ? `${task.actualHours}h`    : "—" },
          { label: "Robot",          value: task.robot?.displayName ?? "—" },
          { label: "Created by",     value: task.createdBy?.name ?? "—" },
          { label: "Completed",      value: task.completionDate ? formatDate(task.completionDate) : "—" },
          { label: "Design review",  value: task.designReviewStatus.replace(/_/g, " ") },
        ].map((m) => (
          <div key={m.label} className="card py-3">
            <p className="text-label text-[--color-text-secondary]">{m.label}</p>
            <p className="text-sm font-medium text-[--color-text-primary] mt-0.5">{m.value}</p>
          </div>
        ))}
      </div>

      {/* Description */}
      {task.description && (
        <div className="card">
          <p className="text-label text-[--color-text-secondary] mb-1">Description</p>
          <p className="text-body text-[--color-text-primary] whitespace-pre-wrap">{task.description}</p>
        </div>
      )}

      {/* Blockers */}
      {task.blockersNotes && (
        <div className="card border-l-4 border-l-[--color-danger]">
          <p className="text-label text-[--color-danger] mb-1">Blockers / notes</p>
          <p className="text-body text-[--color-text-primary]">{task.blockersNotes}</p>
        </div>
      )}

      {/* Assignees */}
      {task.assignees.length > 0 && (
        <div className="card">
          <p className="text-label text-[--color-text-secondary] mb-2">Assignees</p>
          <div className="flex flex-wrap gap-2">
            {task.assignees.map((a) => (
              <div key={a.id} className="flex items-center gap-2 rounded-full bg-[--color-surface-overlay] px-3 py-1">
                <div className="w-5 h-5 rounded-full bg-[--color-primary] text-white text-xs font-bold flex items-center justify-center">
                  {a.name[0].toUpperCase()}
                </div>
                <span className="text-sm text-[--color-text-primary]">{a.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dependencies */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {task.prerequisites.length > 0 && (
          <div className="card">
            <p className="text-label text-[--color-text-secondary] mb-2">Prerequisites</p>
            <div className="space-y-2">
              {task.prerequisites.map((p) => (
                <Link key={p.id} href={`/schedule/tasks/${p.id}`}
                  className="flex items-center justify-between hover:text-[--color-primary] transition-colors">
                  <span className="text-sm text-[--color-text-primary]">{p.name}</span>
                  <Badge variant={STATUS_CONFIG[p.status as keyof typeof STATUS_CONFIG]?.variant ?? "neutral"}>
                    {STATUS_CONFIG[p.status as keyof typeof STATUS_CONFIG]?.label ?? p.status}
                  </Badge>
                </Link>
              ))}
            </div>
          </div>
        )}

        {task.dependents.length > 0 && (
          <div className="card">
            <p className="text-label text-[--color-text-secondary] mb-2">Unlocks</p>
            <div className="space-y-2">
              {task.dependents.map((d) => (
                <Link key={d.id} href={`/schedule/tasks/${d.id}`}
                  className="flex items-center justify-between hover:text-[--color-primary] transition-colors">
                  <span className="text-sm text-[--color-text-primary]">{d.name}</span>
                  <Badge variant={STATUS_CONFIG[d.status as keyof typeof STATUS_CONFIG]?.variant ?? "neutral"}>
                    {STATUS_CONFIG[d.status as keyof typeof STATUS_CONFIG]?.label ?? d.status}
                  </Badge>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Design review */}
      {task.designReviewRequired && task.designReview && (
        <div className="card">
          <p className="text-label text-[--color-text-secondary] mb-2">Design review</p>
          <div className="flex items-center justify-between">
            <p className="text-sm text-[--color-text-primary]">
              {task.designReview.decision ?? "Pending review"}
            </p>
            {task.designReview.comments && (
              <p className="text-small text-[--color-text-secondary]">{task.designReview.comments}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
