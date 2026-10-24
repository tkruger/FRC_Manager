import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { seasonStarted } from "@/lib/season-meetings";
import { redirect } from "next/navigation";
import { ActiveSeasonCard } from "./ActiveSeasonCard";
import { NewSeasonButton } from "./NewSeasonButton";
import { PastSeasonsCard } from "./PastSeasonsCard";
import { PageHeader } from "@/components/PageHeader";

export default async function SeasonSettingsPage() {
  const session = await auth();
  if (!session?.user?.teamId) redirect("/dashboard");

  const isHeadMentor = session.user.roles.includes("HEAD_MENTOR" as any);

  const seasons = await prisma.season.findMany({
    where: { teamId: session.user.teamId },
    include: {
      robots: { where: { archived: false }, orderBy: { createdAt: "asc" } },
      competitionEvents: { orderBy: { startDate: "asc" } },
      _count: { select: { tasks: true, meetings: true } },
    },
    orderBy: { year: "desc" },
  });

  const activeSeason = seasons.find((s) => s.isActive);
  // Not active: future seasons (set up ahead; one becomes active on its start date) and past ones
  const upcomingSeasons = seasons.filter((s) => !s.isActive && !seasonStarted(s.startDate))
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  const pastSeasons  = seasons.filter((s) => !s.isActive && seasonStarted(s.startDate));

  // Task completion stats for past seasons
  const pastSeasonStats = await Promise.all(
    pastSeasons.map(async (s) => {
      const [complete, total] = await Promise.all([
        prisma.task.count({ where: { seasonId: s.id, status: "COMPLETE" } }),
        prisma.task.count({ where: { seasonId: s.id } }),
      ]);
      return { id: s.id, complete, total };
    })
  );
  const statsById = Object.fromEntries(pastSeasonStats.map((s) => [s.id, s]));

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <PageHeader
        title="Season"
        help="season"
        subtitle="The season today falls in is active. Set up the next one ahead of time — it takes over on its start date."
        actions={isHeadMentor && <NewSeasonButton hasActiveSeason={!!activeSeason} />}
      />

      {/* No active season prompt */}
      {!activeSeason && (
        <div className="card text-center py-12">
          <p className="text-body text-(--color-text-secondary) mb-4">
            No active season yet. Create one to start tracking robots, tasks, and inventory.
          </p>
          {isHeadMentor
            ? <NewSeasonButton hasActiveSeason={false} label="Create first season" />
            : <p className="text-small text-(--color-text-disabled)">Contact your Head Mentor to set up a season.</p>}
        </div>
      )}

      {/* Active season card */}
      {activeSeason && (
        <ActiveSeasonCard
          season={{
            ...activeSeason,
            startLocked: seasonStarted(activeSeason.startDate),
            meetingDayTimes: activeSeason.meetingDayTimes as Record<string, { start: string; end: string }[] | { start: string; end: string }> | null,
            competitions: activeSeason.competitionEvents.map((c) => ({
              id: c.id, name: c.name, location: c.location, stage: c.stage, stageNumber: c.stageNumber,
              startDate: c.startDate.toISOString(), endDate: c.endDate.toISOString(),
            })),
          }}
          canEdit={isHeadMentor}
        />
      )}

      {/* Upcoming seasons */}
      {upcomingSeasons.length > 0 && (
        <PastSeasonsCard
          title="Upcoming seasons"
          seasons={upcomingSeasons.map((s) => ({
            id: s.id, name: s.name, year: s.year, robotCount: s.robots.length, taskCount: 0, taskComplete: 0,
            note: `Starts ${s.startDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}`,
          }))}
        />
      )}

      {/* Past seasons */}
      {pastSeasons.length > 0 && (
        <PastSeasonsCard
          seasons={pastSeasons.map((s) => ({
            id:           s.id,
            name:         s.name,
            year:         s.year,
            robotCount:   s.robots.length,
            taskCount:    statsById[s.id]?.total  ?? 0,
            taskComplete: statsById[s.id]?.complete ?? 0,
          }))}
        />
      )}
    </div>
  );
}
