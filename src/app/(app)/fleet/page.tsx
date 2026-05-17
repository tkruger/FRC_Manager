import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress";
import { formatWeight, formatCurrency } from "@/lib/utils";

const ROBOT_WEIGHT_LIMIT = 115; // lbs body
const BOM_CAP = 5000;

const ROLE_LABELS: Record<string, string> = {
  COMPETITION: "Competition Bot",
  PRACTICE:    "Practice Bot",
  DEMO:        "Demo Bot",
  RETIRED:     "Retired",
  OTHER:       "Other",
};

const STATUS_BADGE: Record<string, "success" | "info" | "neutral" | "warning"> = {
  ACTIVE_BUILD:              "info",
  ACTIVE_COMPETITION_READY:  "success",
  RETIRED_DISPLAY:           "neutral",
  RETIRED_STORAGE:           "neutral",
  DECOMMISSIONED:            "neutral",
};

export default async function FleetPage() {
  const session = await auth();
  if (!session?.user?.teamId) redirect("/dashboard");

  const [activeSeason, pastSeasons] = await Promise.all([
    prisma.season.findFirst({
      where: { teamId: session.user.teamId, isActive: true },
      include: {
        robots: {
          where: { archived: false },
          include: {
            inUseItems: { where: { status: { in: ["INSTALLED_ROBOT", "INSTALLED_PRACTICE"] } }, select: { unitWeight: true, quantity: true, subsystem: true } },
            bomItems:   { select: { totalFmv: true, exemptKop: true, exemptFirstChoice: true, exemptUnder5: true } },
            weightSnaps:{ orderBy: { createdAt: "desc" }, take: 1, select: { weight: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    }),
    prisma.season.findMany({
      where: { teamId: session.user.teamId, isActive: false },
      include: {
        robots: { where: { archived: false }, select: { id: true, displayName: true, role: true, status: true } },
      },
      orderBy: { year: "desc" },
    }),
  ]);

  type ActiveRobot = NonNullable<typeof activeSeason>["robots"][0];

  function getWeight(robot: ActiveRobot) {
    const snap = robot.weightSnaps[0];
    if (snap) return snap.weight;
    return robot.inUseItems.reduce((s, i) => s + (i.unitWeight ?? 0) * i.quantity, 0);
  }

  function getBomFmv(robot: ActiveRobot) {
    return robot.bomItems
      .filter((b) => !b.exemptKop && !b.exemptFirstChoice && !b.exemptUnder5)
      .reduce((s, b) => s + (b.totalFmv ?? 0), 0);
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h1 text-[--color-text-primary]">Robot Fleet</h1>
          <p className="text-body text-[--color-text-secondary] mt-1">
            {activeSeason ? activeSeason.name : "No active season"}
          </p>
        </div>
        {activeSeason && (
          <Link href="/settings/season">
            <Button variant="outline" size="sm">+ Add robot</Button>
          </Link>
        )}
      </div>

      {/* Active robots */}
      {activeSeason && activeSeason.robots.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {activeSeason.robots.map((robot) => {
            const weight  = getWeight(robot);
            const bomFmv  = getBomFmv(robot);
            const statusBadge = STATUS_BADGE[robot.status] ?? "neutral";

            return (
              <Link key={robot.id} href={`/fleet/${robot.id}`}
                className="card hover:border-[--color-primary] transition-colors group flex flex-col gap-4"
                style={{ borderLeftWidth: 4, borderLeftColor: robot.role === "COMPETITION" ? "var(--color-primary)" : "var(--color-secondary)" }}>

                {/* Robot header */}
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-h3 text-[--color-text-primary] group-hover:text-[--color-primary] transition-colors">
                      {robot.displayName}
                    </h2>
                    <p className="text-small text-[--color-text-secondary] mt-0.5">{ROLE_LABELS[robot.role]}</p>
                  </div>
                  <Badge variant={statusBadge}>{robot.status.replace(/_/g, " ")}</Badge>
                </div>

                {/* Weight progress */}
                <div>
                  <ProgressBar
                    value={weight}
                    max={robot.weightTarget ?? ROBOT_WEIGHT_LIMIT}
                    label="Weight"
                    sublabel={`${formatWeight(weight)} / ${formatWeight(robot.weightTarget ?? ROBOT_WEIGHT_LIMIT)}`}
                    warnAt={90}
                    dangerAt={98}
                  />
                </div>

                {/* BOM progress */}
                <div>
                  <ProgressBar
                    value={bomFmv}
                    max={BOM_CAP}
                    label="BOM FMV"
                    sublabel={`${formatCurrency(bomFmv)} / ${formatCurrency(BOM_CAP)}`}
                    warnAt={80}
                    dangerAt={95}
                  />
                </div>

                {robot.description && (
                  <p className="text-small text-[--color-text-secondary] truncate">{robot.description}</p>
                )}
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="card text-center py-12">
          <p className="text-body text-[--color-text-secondary] mb-4">
            {activeSeason ? "No robots added yet." : "Set up a season to start managing robots."}
          </p>
          <Link href="/settings/season">
            <Button>{activeSeason ? "Add robot" : "Set up season"}</Button>
          </Link>
        </div>
      )}

      {/* Historical archive */}
      {pastSeasons.length > 0 && (
        <div>
          <h2 className="text-h2 text-[--color-text-primary] mb-3">Historical archive</h2>
          <div className="space-y-3">
            {pastSeasons.map((season) => (
              <div key={season.id} className="card">
                <h3 className="text-h3 text-[--color-text-primary] mb-2">{season.name}</h3>
                {season.robots.length === 0 ? (
                  <p className="text-small text-[--color-text-secondary]">No robots</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {season.robots.map((r) => (
                      <Link key={r.id} href={`/fleet/${r.id}`}>
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-[--color-border] text-small text-[--color-text-primary] hover:border-[--color-primary] hover:text-[--color-primary] transition-colors">
                          {r.displayName}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
