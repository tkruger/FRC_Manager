import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { SeasonForm } from "./SeasonForm";
import { ActiveSeasonCard } from "./ActiveSeasonCard";

export default async function SeasonSettingsPage() {
  const session = await auth();
  if (!session?.user?.teamId) redirect("/dashboard");

  const seasons = await prisma.season.findMany({
    where: { teamId: session.user.teamId },
    include: { robots: { where: { archived: false }, orderBy: { createdAt: "asc" } } },
    orderBy: { year: "desc" },
  });

  const activeSeason = seasons.find((s) => s.isActive);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div>
        <h1 className="text-h1 text-[--color-text-primary]">Season Settings</h1>
        <p className="text-body text-[--color-text-secondary] mt-1">
          Configure the active build season, kickoff date, and robots.
        </p>
      </div>

      {/* Active season card — shows summary with Edit button, expands to form */}
      {activeSeason && <ActiveSeasonCard season={activeSeason} />}

      {/* Create new season */}
      <div className="card">
        <h2 className="text-h3 text-[--color-text-primary] mb-4">
          {activeSeason ? "Create a new season" : "Set up your first season"}
        </h2>
        <SeasonForm />
      </div>

      {/* Past seasons */}
      {seasons.filter((s) => !s.isActive).length > 0 && (
        <div className="card">
          <h2 className="text-h3 text-[--color-text-primary] mb-3">Past seasons</h2>
          <div className="space-y-2">
            {seasons.filter((s) => !s.isActive).map((s) => (
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
