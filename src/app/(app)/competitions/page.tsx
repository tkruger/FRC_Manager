import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/PageHeader";
import { designation } from "@/lib/competition";
import { eventWindow } from "@/lib/frc/event-live";
import { FALLBACK_TIMEZONE, isValidTimezone, localParts } from "@/lib/notify/time";
import { FollowAlong } from "@/components/competitions/parts";

// The season's competitions — each opens its event page (schedule, results, where to follow along)

const DAY = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

export default async function CompetitionsPage() {
  const session = await auth();
  if (!session?.user?.teamId) redirect("/dashboard");

  const [team, seasons] = await Promise.all([
    prisma.team.findUnique({ where: { id: session.user.teamId }, select: { teamNumber: true, timezone: true } }),
    prisma.season.findMany({
      where:   { teamId: session.user.teamId },
      orderBy: { startDate: "desc" },
      take:    3,
      select:  {
        id: true, name: true, year: true, isActive: true,
        competitionEvents: {
          orderBy: { startDate: "asc" },
          select: { id: true, name: true, location: true, startDate: true, endDate: true, stage: true, stageNumber: true, tbaEventKey: true },
        },
      },
    }),
  ]);
  const todayKey = localParts(new Date(), isValidTimezone(team?.timezone) ? team!.timezone! : FALLBACK_TIMEZONE).dateKey;
  const shown = seasons.filter((s) => s.isActive || s.competitionEvents.length > 0);
  const year = shown.find((s) => s.isActive)?.year ?? new Date().getFullYear();

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <PageHeader
        title="Competitions"
        help="competitions"
        subtitle="Our events — match schedules, bumper colors, results and where to watch"
        actions={<Link href="/competitions/history" className="text-sm font-medium text-(--color-secondary) hover:underline">Team history →</Link>}
      />

      {shown.length === 0 && (
        <div className="card py-6 text-center text-body text-(--color-text-secondary)">No competitions yet. A Head Mentor adds them in Season settings.</div>
      )}

      {shown.map((s) => (
        <section key={s.id} className="space-y-3">
          <h2 className="text-h2 text-(--color-text-primary)">{s.name}</h2>
          {s.competitionEvents.length === 0 ? (
            <div className="card py-6 text-center text-body text-(--color-text-secondary)">No competitions added yet.</div>
          ) : (
            <ul className="card p-0 divide-y divide-(--color-border) overflow-hidden">
              {s.competitionEvents.map((c) => {
                const w = eventWindow(todayKey, c.startDate, c.endDate);
                return (
                  <li key={c.id}>
                    <Link href={`/competitions/${c.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-(--color-surface-overlay)">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="shrink-0 rounded px-1.5 py-0.5 font-mono text-xs font-semibold bg-(--color-secondary)/10 text-(--color-secondary)">
                          {designation(c.stage, c.stageNumber)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-(--color-text-primary)">{c.name}</p>
                          <p className="truncate text-small text-(--color-text-secondary)">
                            {DAY(c.startDate)}{c.location ? ` · ${c.location}` : ""}
                          </p>
                        </div>
                      </div>
                      {w === "live"
                        ? <span className="shrink-0 rounded-full bg-(--color-danger) px-2 py-0.5 text-xs font-bold uppercase text-white">Live</span>
                        : w === "after" ? <span className="shrink-0 text-small text-(--color-text-secondary)">Done</span> : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ))}

      {team && <FollowAlong team={team.teamNumber} eventKey={null} year={year} streams={[]} />}
    </div>
  );
}
