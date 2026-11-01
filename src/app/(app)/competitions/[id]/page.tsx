import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageTitle } from "@/components/PageHeader";
import { designation } from "@/lib/competition";
import { links } from "@/lib/frc/links";
import { tbaConfigured } from "@/lib/frc/tba";
import { eventWindow, loadEventLive, type EventLive } from "@/lib/frc/event-live";
import { FALLBACK_TIMEZONE, isValidTimezone, localParts } from "@/lib/notify/time";
import { AutoRefresh } from "@/components/competitions/AutoRefresh";
import { BumperChip, EventExplainer, FollowAlong, matchTime, ResultChip } from "@/components/competitions/parts";

const DAY = (d: Date) => d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

/** One competition: our next match and bumper color, our matches and rank, and where to follow along */
export default async function CompetitionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.teamId) redirect("/dashboard");

  const [comp, team] = await Promise.all([
    prisma.competitionEvent.findFirst({
      where:  { id, season: { teamId: session.user.teamId } },
      select: { id: true, name: true, location: true, startDate: true, endDate: true, stage: true, stageNumber: true, tbaEventKey: true, season: { select: { year: true } } },
    }),
    prisma.team.findUnique({ where: { id: session.user.teamId }, select: { teamNumber: true, timezone: true } }),
  ]);
  if (!comp || !team) notFound();

  const teamTz = isValidTimezone(team.timezone) ? team.timezone! : FALLBACK_TIMEZONE;
  const when = eventWindow(localParts(new Date(), teamTz).dateKey, comp.startDate, comp.endDate);
  const live: EventLive | null = comp.tbaEventKey && tbaConfigured() ? await loadEventLive(team.teamNumber, comp.tbaEventKey) : null;
  const tz = isValidTimezone(live?.event?.timezone) ? live!.event!.timezone! : teamTz;
  const year = comp.season.year;
  const status = live?.status;
  const rank = status?.qual?.ranking;
  const isHeadMentor = session.user.roles.includes("HEAD_MENTOR" as never);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {when === "live" && live && <AutoRefresh />}
      <div>
        <nav className="text-small text-(--color-text-secondary) mb-1">
          <Link href="/competitions" className="hover:text-(--color-primary)">Competitions</Link>
          <span className="mx-2">›</span>{designation(comp.stage, comp.stageNumber)}
        </nav>
        <PageTitle help="competitions">{comp.name}</PageTitle>
        <p className="mt-1 text-sm text-(--color-text-secondary)">
          {DAY(comp.startDate)}{comp.endDate.toISOString().slice(0, 10) !== comp.startDate.toISOString().slice(0, 10) && ` – ${DAY(comp.endDate)}`}
          {(live?.event?.location_name || comp.location) && ` · ${[live?.event?.location_name, comp.location].filter(Boolean).join(", ")}`}
          {when === "live" && <span className="ml-2 rounded-full bg-(--color-danger) px-2 py-0.5 text-xs font-bold uppercase text-white">Live</span>}
        </p>
      </div>

      {!comp.tbaEventKey && (
        <div className="card border-l-4 border-l-(--color-warning) text-sm">
          <p className="text-(--color-text-primary)">This competition isn&apos;t linked to its event yet, so there&apos;s no schedule or results here.</p>
          <p className="mt-1 text-(--color-text-secondary)">
            {isHeadMentor
              ? <>Add its event code in <Link href="/settings/season" className="text-(--color-secondary) hover:underline">Season settings</Link> — edit the competition and pick it from The Blue Alliance or paste a link.</>
              : "A Head Mentor can link it in Season settings."}
          </p>
        </div>
      )}

      {/* Where we stand */}
      {live && (status || live.next) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {live.next && (
            <section className="card space-y-2 border-l-4" style={{ borderLeftColor: live.next.color === "red" ? "#DC2626" : "#2563EB" }}>
              <p className="text-small text-(--color-text-secondary)">Our next match</p>
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-h2 text-(--color-text-primary)">{live.next.label}</span>
                <BumperChip color={live.next.color} />
              </div>
              {live.next.when && <p className="text-sm text-(--color-text-primary)">About {matchTime(live.next.when, tz)}</p>}
              <p className="text-small text-(--color-text-secondary)">
                With {live.next.partners.join(" & ") || "—"} · against {live.next.opponents.join(", ") || "—"}
              </p>
              <a href={links.match13Match(live.next.key)} target="_blank" rel="noopener noreferrer" className="text-small text-(--color-secondary) hover:underline">
                Prediction on Match13 ↗
              </a>
            </section>
          )}
          {status && (
            <section className="card space-y-1">
              <p className="text-small text-(--color-text-secondary)">How we&apos;re doing</p>
              {rank?.rank != null && (
                <p className="text-h2 text-(--color-text-primary)">
                  Rank {rank.rank}{status.qual?.num_teams ? <span className="text-sm font-normal text-(--color-text-secondary)"> of {status.qual.num_teams}</span> : null}
                </p>
              )}
              {rank?.record && <p className="text-sm text-(--color-text-primary)">{rank.record.wins}–{rank.record.losses}–{rank.record.ties} (wins–losses–ties)</p>}
              {status.alliance && <p className="text-sm text-(--color-text-primary)">{status.alliance.name ?? `Alliance ${status.alliance.number}`} — {status.alliance.pick === 0 ? "captain" : `pick ${status.alliance.pick}`}</p>}
              {status.overall_status_str && <p className="text-small text-(--color-text-secondary)">{status.overall_status_str}</p>}
            </section>
          )}
        </div>
      )}

      {/* Our matches */}
      {live && (
        <section className="card p-0 overflow-hidden">
          <h2 className="text-h3 text-(--color-text-primary) px-4 pt-4 pb-2">Our matches</h2>
          {live.matches.length === 0 ? (
            <p className="px-4 pb-4 text-small text-(--color-text-secondary)">
              {when === "after" ? "No matches recorded." : "The match schedule isn't out yet — it's usually posted the evening before or the morning of the first match day."}
            </p>
          ) : (
            <ul className="divide-y divide-(--color-border)">
              {live.matches.map((m) => (
                <li key={m.key} className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2.5 ${live.next?.key === m.key ? "bg-(--color-primary)/5" : ""}`}>
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="w-1.5 self-stretch rounded" style={{ backgroundColor: m.color === "red" ? "#DC2626" : "#2563EB" }} aria-hidden />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-(--color-text-primary)">
                        {m.label} <span className="sr-only">({m.color})</span>
                        {live.next?.key === m.key && <span className="ml-2 text-xs font-semibold text-(--color-primary)">Next</span>}
                      </p>
                      <p className="text-small text-(--color-text-secondary)">
                        {m.result == null && m.when ? `${matchTime(m.when, tz)} · ` : ""}with {m.partners.join(" & ")} · vs {m.opponents.join(", ")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {m.result && <span className="text-sm tabular-nums text-(--color-text-primary)">{m.ourScore}–{m.theirScore}</span>}
                    <ResultChip result={m.result} />
                    <a href={links.match13Match(m.key)} target="_blank" rel="noopener noreferrer" className="text-small text-(--color-secondary) hover:underline">Match13</a>
                    <a href={links.tbaMatch(m.key)} target="_blank" rel="noopener noreferrer" className="text-small text-(--color-secondary) hover:underline">TBA</a>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {comp.tbaEventKey && !tbaConfigured() && (
        <p className="text-small text-(--color-text-secondary)">
          The schedule and results show here once the app is connected to The Blue Alliance. Until then, the links below have everything.
        </p>
      )}

      <FollowAlong team={team.teamNumber} eventKey={comp.tbaEventKey} year={year} streams={live?.streams ?? []} />
      <EventExplainer team={team.teamNumber} />
    </div>
  );
}
