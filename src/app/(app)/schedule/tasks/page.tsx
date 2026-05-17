import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableHead, TableBody, Th, Td, Tr } from "@/components/ui/table";
import { shortDate, STATUS_CONFIG, PRIORITY_CONFIG, SUBTEAM_COLORS, isOverdue } from "@/lib/schedule-helpers";
import { TaskStatusButton } from "./TaskStatusButton";

export default async function TaskListPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; subTeam?: string; status?: string }>;
}) {
  const { filter, subTeam, status } = await searchParams;
  const session = await auth();
  if (!session?.user?.teamId) redirect("/dashboard");

  const activeSeason = await prisma.season.findFirst({
    where: { teamId: session.user.teamId, isActive: true },
  });
  if (!activeSeason) redirect("/settings/season");

  const now = new Date();

  const tasks = await prisma.task.findMany({
    where: {
      seasonId: activeSeason.id,
      ...(subTeam ? { subTeam: subTeam as any } : {}),
      ...(status  ? { status:  status  as any } : {}),
    },
    include: {
      assignees: { select: { id: true, name: true } },
      robot:     { select: { displayName: true } },
      prerequisites: { select: { id: true, name: true, status: true } },
    },
    orderBy: [{ dueDate: "asc" }, { priority: "asc" }],
  });

  // Apply client-side filters
  const filtered = tasks.filter((t) => {
    if (filter === "overdue")    return isOverdue(t);
    if (filter === "milestones") return t.isMilestone;
    if (filter === "this-week") {
      const start = new Date(now); start.setDate(now.getDate() - now.getDay() + 1);
      const end   = new Date(start); end.setDate(start.getDate() + 6);
      return t.dueDate && t.dueDate >= start && t.dueDate <= end && t.status !== "COMPLETE";
    }
    if (filter === "blocked")   return t.status === "BLOCKED";
    return true;
  });

  const filterTabs = [
    { label: "All",         href: "/schedule/tasks" },
    { label: "Overdue",     href: "/schedule/tasks?filter=overdue" },
    { label: "This week",   href: "/schedule/tasks?filter=this-week" },
    { label: "Milestones",  href: "/schedule/tasks?filter=milestones" },
    { label: "Blocked",     href: "/schedule/tasks?filter=blocked" },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <nav className="text-small text-[--color-text-secondary] mb-1">
            <Link href="/schedule" className="hover:text-[--color-primary]">Schedule</Link>
            <span className="mx-2">›</span>Tasks
          </nav>
          <h1 className="text-h1 text-[--color-text-primary]">Tasks</h1>
          <p className="text-body text-[--color-text-secondary] mt-0.5">{filtered.length} of {tasks.length} tasks</p>
        </div>
        <Link href="/schedule/tasks/new"><Button size="sm">+ New task</Button></Link>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 border-b border-[--color-border] overflow-x-auto">
        {filterTabs.map((tab) => {
          const activeTab = (filter ? `?filter=${filter}` : "") === (tab.href.includes("?") ? "?" + tab.href.split("?")[1] : "");
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab
                  ? "border-[--color-primary] text-[--color-primary]"
                  : "border-transparent text-[--color-text-secondary] hover:text-[--color-text-primary]"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-body text-[--color-text-secondary] mb-4">No tasks match this filter.</p>
          <Link href="/schedule/tasks/new"><Button size="sm">Create task</Button></Link>
        </div>
      ) : (
        <Table>
          <TableHead>
            <tr>
              <Th>Task</Th>
              <Th>Sub-team</Th>
              <Th>Assignees</Th>
              <Th>Due</Th>
              <Th>Priority</Th>
              <Th>Status</Th>
              <Th>Robot</Th>
            </tr>
          </TableHead>
          <TableBody>
            {filtered.map((t) => {
              const statusCfg = STATUS_CONFIG[t.status];
              const priorityCfg = PRIORITY_CONFIG[t.priority];
              const overdue = isOverdue(t);
              const stColor = SUBTEAM_COLORS[t.subTeam ?? ""] ?? "#64748B";

              return (
                <Tr key={t.id}>
                  <Td>
                    <Link href={`/schedule/tasks/${t.id}`} className="hover:text-[--color-primary] transition-colors">
                      <div className="flex items-center gap-1.5">
                        {t.isMilestone && <span className="text-[--color-primary] text-xs">◆</span>}
                        <span className="font-medium text-[--color-text-primary]">{t.name}</span>
                      </div>
                      {t.prerequisites.some((p) => p.status !== "COMPLETE") && (
                        <p className="text-small text-[--color-danger] mt-0.5">Has incomplete deps</p>
                      )}
                    </Link>
                  </Td>
                  <Td>
                    {t.subTeam ? (
                      <span className="text-sm font-medium" style={{ color: stColor }}>
                        {t.subTeam.replace("_", " ")}
                      </span>
                    ) : "—"}
                  </Td>
                  <Td>
                    <div className="flex -space-x-1">
                      {t.assignees.slice(0, 3).map((a) => (
                        <div key={a.id} title={a.name}
                          className="w-6 h-6 rounded-full bg-[--color-primary] text-white text-xs font-bold flex items-center justify-center border border-[--color-surface]">
                          {a.name[0].toUpperCase()}
                        </div>
                      ))}
                      {t.assignees.length > 3 && (
                        <div className="w-6 h-6 rounded-full bg-[--color-surface-overlay] text-[--color-text-secondary] text-xs flex items-center justify-center border border-[--color-surface]">
                          +{t.assignees.length - 3}
                        </div>
                      )}
                      {t.assignees.length === 0 && <span className="text-[--color-text-disabled] text-sm">—</span>}
                    </div>
                  </Td>
                  <Td>
                    <span className={overdue ? "text-[--color-danger] font-medium" : "text-[--color-text-primary]"}>
                      {shortDate(t.dueDate)}
                    </span>
                  </Td>
                  <Td><Badge variant={priorityCfg.variant}>{priorityCfg.label}</Badge></Td>
                  <Td><TaskStatusButton taskId={t.id} currentStatus={t.status} /></Td>
                  <Td>{t.robot?.displayName ?? "—"}</Td>
                </Tr>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
