import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { ActiveSeasonCard } from "./ActiveSeasonCard";
import { NewSeasonButton } from "./NewSeasonButton";

export default async function SeasonSettingsPage() {
  const session = await auth();
  if (!session?.user?.teamId) redirect("/dashboard");

  const seasons = await prisma.season.findMany({
    where: { teamId: session.user.teamId },
    include: { robots: { where: { archived: false }, orderBy: { createdAt: "asc" } } },
    orderBy: { year: "desc" },
  });

  const activeSeason = seasons.find((s) => s.isActive);
  const pastSeasons = seasons.filter((s) => !s.isActive);

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
      {activeSeason && <ActiveSeasonCard season={activeSeason} />}

      {/* Past seasons */}
      {pastSeasons.length > 0 && (
        <div className="card">
          <h2 className="text-h3 text-[--color-text-primary] mb-3">Past seasons</h2>
          <div className="space-y-2">
            {pastSeasons.map((s) => (
              <div key={s.id} className="flex items-center justify-between py-2 border-b border-[--color-border] last:border-0">
                <span className="text-sm text-[--color-text-primary]">{s.name}</span>
                <span className="text-small text-[--color-text-secondary]">{s.robots.length} robot(s)</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
