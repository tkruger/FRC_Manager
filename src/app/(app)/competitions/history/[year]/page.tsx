import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/PageHeader";
import { links } from "@/lib/frc/links";
import { eventResultSummary } from "@/lib/frc/tba";
import { tbaFor } from "@/lib/frc/team-keys";

const DAY = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/** One season: each event, how it went, and the awards won there */
export default async function HistoryYearPage({ params }: { params: Promise<{ year: string }> }) {
  const { year: raw } = await params;
  if (!/^\d{4}$/.test(raw)) notFound();
  const year = Number(raw);
  const session = await auth();
  if (!session?.user?.teamId) redirect("/dashboard");
  const team = await prisma.team.findUnique({ where: { id: session.user.teamId }, select: { teamNumber: true } });
  if (!team) redirect("/dashboard");
  const tba = await tbaFor(session.user.teamId);
  if (!tba) redirect("/competitions/history");
  const n = team.teamNumber;

  const [events, statuses, awards] = await Promise.all([tba.teamEvents(n, year), tba.teamEventStatuses(n, year), tba.teamAwards(n)]);
  const list = (events ?? []).sort((a, b) => a.start_date.localeCompare(b.start_date));

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <PageHeader
        title={`${year} season`}
        help="competitions"
        breadcrumb={<>
          <Link href="/competitions" className="hover:text-(--color-primary)">Competitions</Link><span className="mx-2">›</span>
          <Link href="/competitions/history" className="hover:text-(--color-primary)">History</Link><span className="mx-2">›</span>{year}
        </>}
        actions={<a href={links.tbaTeam(n, year)} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-(--color-secondary) hover:underline">On The Blue Alliance ↗</a>}
      />

      {list.length === 0 && <div className="card text-sm text-(--color-text-secondary)">No events found for {year}.</div>}

      <ul className="space-y-3">
        {list.map((e) => {
          const s = statuses?.[e.key];
          const won = (awards ?? []).filter((a) => a.event_key === e.key);
          return (
            <li key={e.key}>
              <Link href={`/competitions/event/${e.key}`} className="card block no-underline hover:border-(--color-primary)">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-h3 text-(--color-text-primary)">{e.name}</h2>
                  <span className="text-small text-(--color-text-secondary)">
                    {DAY(e.start_date)}{e.end_date !== e.start_date && ` – ${DAY(e.end_date)}`}
                  </span>
                </div>
                <p className="text-small text-(--color-text-secondary)">{[e.city, e.state_prov, e.country].filter(Boolean).join(", ")}{e.week != null ? ` · Week ${e.week + 1}` : ""}</p>
                {eventResultSummary(s) && <p className="mt-2 text-sm text-(--color-text-primary)">{eventResultSummary(s)}</p>}
                {won.length > 0 && <p className="mt-1 text-sm text-(--color-text-primary)">🏅 {won.map((a) => a.name).join(" · ")}</p>}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
