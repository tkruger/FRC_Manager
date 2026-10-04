import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ActiveSeasonCard } from "../ActiveSeasonCard";

// Full-page view of a past season (the active season lives on /settings/season).
export default async function PastSeasonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.teamId) redirect("/dashboard");

  const season = await prisma.season.findFirst({
    where:   { id, teamId: session.user.teamId },
    include: {
      robots: { where: { archived: false }, orderBy: { createdAt: "asc" } },
      _count: { select: { meetings: true, competitionEvents: true } },
    },
  });
  if (!season) notFound();
  if (season.isActive) redirect("/settings/season");

  const [taskTotal, taskComplete, milestones] = await Promise.all([
    prisma.task.count({ where: { seasonId: season.id } }),
    prisma.task.count({ where: { seasonId: season.id, status: "COMPLETE" } }),
    prisma.task.findMany({
      where:   { seasonId: season.id, isMilestone: true },
      select:  { id: true, name: true, status: true, dueDate: true },
      orderBy: { dueDate: "asc" },
    }),
  ]);
  const pct = taskTotal > 0 ? Math.round((taskComplete / taskTotal) * 100) : null;
  const isHeadMentor = session.user.roles.includes("HEAD_MENTOR");

  const stats = [
    { label: "Meetings",     value: season._count.meetings },
    { label: "Tasks",        value: taskTotal },
    { label: "Completed",    value: pct === null ? "—" : `${pct}%` },
    { label: "Competitions", value: season._count.competitionEvents },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div>
        <nav className="text-small text-(--color-text-secondary) mb-1">
          <Link href="/settings/season" className="hover:text-(--color-primary)">Season</Link>
          <span className="mx-2">›</span>{season.name}
        </nav>
        <h1 className="text-h1 text-(--color-text-primary)">{season.name}</h1>
        <p className="text-body text-(--color-text-secondary) mt-1">{season.year} build season</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="card py-3 text-center">
            <p className="text-h2 text-(--color-text-primary)">{s.value}</p>
            <p className="text-label text-(--color-text-secondary)">{s.label}</p>
          </div>
        ))}
      </div>

      <ActiveSeasonCard
        isActive={false}
        canEdit={isHeadMentor}
        season={{
          ...season,
          meetingDayTimes: season.meetingDayTimes as Record<string, { start: string; end: string }> | null,
        }}
      />

      {milestones.length > 0 && (
        <section className="card space-y-3">
          <h2 className="text-h3 text-(--color-text-primary)">Milestones</h2>
          <ul className="divide-y divide-(--color-border)">
            {milestones.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 py-2">
                <span className="text-sm text-(--color-text-primary)">
                  <span className="text-(--color-primary) mr-1">◆</span>{m.name}
                </span>
                <span className="text-small text-(--color-text-secondary) whitespace-nowrap">
                  {m.status === "COMPLETE" ? "✓ Done" : m.status.replace(/_/g, " ").toLowerCase()}
                  {m.dueDate && ` · ${m.dueDate.toISOString().slice(0, 10)}`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
