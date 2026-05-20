import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { ActiveSeasonCard } from "./ActiveSeasonCard";
import { NewSeasonButton } from "./NewSeasonButton";
import { PastSeasonsCard } from "./PastSeasonsCard";

export default async function SeasonSettingsPage() {
  const session = await auth();
  if (!session?.user?.teamId) redirect("/dashboard");

  const seasons = await prisma.season.findMany({
    where: { teamId: session.user.teamId },
    include: {
      robots: { where: { archived: false }, orderBy: { createdAt: "asc" } },
      _count: { select: { tasks: true, meetings: true } },
    },
    orderBy: { year: "desc" },
  });

  const activeSeason = seasons.find((s) => s.isActive);
  const pastSeasons  = seasons.filter((s) => !s.isActive);

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h1 text-[--color-text-primary]">Season Settings</h1>
          <p className="text-body text-[--color-text-secondary] mt-1">
            Configure the active build season, kickoff date, and robots.
          </p>
        </div>
        <NewSeasonButton hasActiveSeason={!!activeSeason} />
      </div>

      {/* No active season prompt */}
      {!activeSeason && (
        <div className="card text-center py-12">
          <p className="text-body text-[--color-text-secondary] mb-4">
            No active season yet. Create one to start tracking robots, tasks, and inventory.
          </p>
          <NewSeasonButton hasActiveSeason={false} label="Create first season" />
        </div>
      )}

      {/* Active season card */}
      {activeSeason && (
        <ActiveSeasonCard season={{
          ...activeSeason,
          meetingDayTimes: activeSeason.meetingDayTimes as Record<string, { start: string; end: string }> | null,
        }} />
      )}

      {/* Past seasons */}
      {pastSeasons.length > 0 && (
        <PastSeasonsCard
          seasons={pastSeasons.map((s) => ({
            id:                s.id,
            name:              s.name,
            year:              s.year,
            kickoffDate:       s.kickoffDate.toISOString(),
            week0Date:         s.week0Date.toISOString(),
            meetingDays:       s.meetingDays,
            meetingStartTime:  s.meetingStartTime,
            meetingEndTime:    s.meetingEndTime,
            meetingDayTimes:   s.meetingDayTimes as Record<string, { start: string; end: string }> | null,
            expectedAttendance:s.expectedAttendance,
            robots: s.robots.map((r) => ({
              id:          r.id,
              displayName: r.displayName,
              role:        r.role,
              status:      r.status,
            })),
            taskCount:     statsById[s.id]?.total  ?? 0,
            taskComplete:  statsById[s.id]?.complete ?? 0,
            meetingCount:  s._count.meetings,
          }))}
        />
      )}
    </div>
  );
}
