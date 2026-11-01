import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/PageHeader";
import { links } from "@/lib/frc/links";
import { eventResultSummary, tbaConfigured, teamAwards, teamEvents, teamEventStatuses, teamInfo, yearsParticipated } from "@/lib/frc/tba";

// The team's history from The Blue Alliance: every season, its events and how each went, and awards.

export default async function HistoryPage() {
  const session = await auth();
  if (!session?.user?.teamId) redirect("/dashboard");
  const team = await prisma.team.findUnique({ where: { id: session.user.teamId }, select: { teamNumber: true } });
  if (!team) redirect("/dashboard");
  const n = team.teamNumber;

  const header = (
    <PageHeader
      title="Team history"
      help="competitions"
      breadcrumb={<><Link href="/competitions" className="hover:text-(--color-primary)">Competitions</Link><span className="mx-2">›</span>History</>}
      subtitle={`Every season Team ${n} has competed — events, results and awards, from The Blue Alliance`}
    />
  );
  if (!tbaConfigured()) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {header}
        <div className="card text-sm text-(--color-text-secondary)">
          History shows once the app is connected to The Blue Alliance. Until then, see{" "}
          <a href={links.tbaTeam(n)} target="_blank" rel="noopener noreferrer" className="text-(--color-secondary) hover:underline">Team {n} on The Blue Alliance ↗</a>.
        </div>
      </div>
    );
  }

  const [info, years, awards] = await Promise.all([teamInfo(n), yearsParticipated(n), teamAwards(n)]);
  const seasons = [...(years ?? [])].sort((a, b) => b - a);
  // Each season's events and results (past seasons are cached for a day)
  const perYear = await Promise.all(seasons.map(async (year) => {
    const [events, statuses] = await Promise.all([teamEvents(n, year), teamEventStatuses(n, year)]);
    return {
      year,
      events: (events ?? []).sort((a, b) => a.start_date.localeCompare(b.start_date)).map((e) => ({
        key: e.key, name: e.short_name || e.name, result: eventResultSummary(statuses?.[e.key]),
        won: statuses?.[e.key]?.playoff?.status === "won" && statuses?.[e.key]?.playoff?.level === "f",
      })),
      awards: (awards ?? []).filter((a) => a.year === year),
    };
  }));
  const wins = perYear.reduce((s, y) => s + y.events.filter((e) => e.won).length, 0);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {header}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          ["Rookie year", info?.rookie_year ?? "—"],
          ["Seasons", seasons.length],
          ["Event wins", wins],
          ["Awards", awards?.length ?? 0],
        ].map(([label, value]) => (
          <div key={label as string} className="card">
            <p className="text-small text-(--color-text-secondary)">{label}</p>
            <p className="text-h2 text-(--color-text-primary) mt-1">{value}</p>
          </div>
        ))}
      </div>

      {seasons.length === 0 && <div className="card text-sm text-(--color-text-secondary)">No seasons found on The Blue Alliance.</div>}

      {perYear.map((y) => (
        <section key={y.year} className="card space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-h2 text-(--color-text-primary)">
              <Link href={`/competitions/history/${y.year}`} className="hover:text-(--color-primary)">{y.year}</Link>
            </h2>
            <Link href={`/competitions/history/${y.year}`} className="text-sm font-medium text-(--color-secondary) hover:underline">Season details →</Link>
          </div>
          <ul className="space-y-1.5">
            {y.events.map((e) => (
              <li key={e.key} className="flex flex-wrap items-baseline justify-between gap-x-4 text-sm">
                <Link href={`/competitions/event/${e.key}`} className="font-medium text-(--color-text-primary) hover:text-(--color-primary)">{e.name}</Link>
                {e.result && <span className="text-small text-(--color-text-secondary)">{e.result}</span>}
              </li>
            ))}
          </ul>
          {y.awards.length > 0 && (
            <p className="text-small text-(--color-text-primary)">🏅 {y.awards.map((a) => a.name).join(" · ")}</p>
          )}
        </section>
      ))}
    </div>
  );
}
