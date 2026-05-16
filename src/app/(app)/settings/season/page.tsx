import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { SeasonForm } from "./SeasonForm";
import { RobotForm } from "./RobotForm";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

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

      {/* Active season summary */}
      {activeSeason && (
        <div className="card border-l-4 border-l-[--color-success]">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-h3 text-[--color-text-primary]">{activeSeason.name}</h2>
                <Badge variant="success">Active</Badge>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-1 text-small text-[--color-text-secondary] mt-2">
                <span>Kickoff: <strong className="text-[--color-text-primary]">{formatDate(activeSeason.kickoffDate)}</strong></span>
                <span>Week 0: <strong className="text-[--color-text-primary]">{formatDate(activeSeason.week0Date)}</strong></span>
                <span>Meeting days: <strong className="text-[--color-text-primary]">{activeSeason.meetingDays.join(", ")}</strong></span>
              </div>
            </div>
          </div>

          {/* Robots in this season */}
          <div className="mt-5 pt-4 border-t border-[--color-border]">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-h3 text-[--color-text-primary]">Robots this season</h3>
            </div>
            {activeSeason.robots.length === 0 ? (
              <p className="text-small text-[--color-text-secondary]">No robots added yet.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                {activeSeason.robots.map((r) => (
                  <div key={r.id} className="rounded-md border border-[--color-border] bg-[--color-surface] px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-[--color-text-primary]">{r.displayName}</p>
                      <p className="text-small text-[--color-text-secondary]">{r.role.replace("_", " ")}</p>
                    </div>
                    <Badge variant={r.status === "ACTIVE_BUILD" ? "info" : r.status === "ACTIVE_COMPETITION_READY" ? "success" : "neutral"}>
                      {r.status.replace(/_/g, " ")}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
            <RobotForm seasonId={activeSeason.id} />
          </div>
        </div>
      )}

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
