import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageTitle } from "@/components/PageHeader";
import { ShareButton } from "@/components/ShareButton";
import { designation } from "@/lib/competition";
import { tbaFor } from "@/lib/frc/team-keys";
import type { TbaAward } from "@/lib/frc/tba";
import { eventWindow, loadEventLive, type EventLive } from "@/lib/frc/event-live";
import { FALLBACK_TIMEZONE, isValidTimezone, localParts } from "@/lib/notify/time";
import { AutoRefresh } from "@/components/competitions/AutoRefresh";
import { EventExplainer, FollowAlong } from "@/components/competitions/parts";
import { EventDetails } from "@/components/competitions/EventDetails";
import { SnoozeAlerts } from "@/components/competitions/SnoozeAlerts";

const DAY = (d: Date) => d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

/** One competition: our next match and bumper color, our matches and rank, and where to follow along */
export default async function CompetitionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.teamId) redirect("/dashboard");

  const [comp, team, me] = await Promise.all([
    prisma.competitionEvent.findFirst({
      where:  { id, season: { teamId: session.user.teamId } },
      select: { id: true, name: true, location: true, startDate: true, endDate: true, stage: true, stageNumber: true, tbaEventKey: true, season: { select: { year: true } } },
    }),
    prisma.team.findUnique({ where: { id: session.user.teamId }, select: { teamNumber: true, timezone: true } }),
    prisma.user.findUnique({ where: { id: session.user.id }, select: { competitionSnoozeUntil: true } }),
  ]);
  if (!comp || !team) notFound();

  const teamTz = isValidTimezone(team.timezone) ? team.timezone! : FALLBACK_TIMEZONE;
  const when = eventWindow(localParts(new Date(), teamTz).dateKey, comp.startDate, comp.endDate);
  const tba = await tbaFor(session.user.teamId);
  const [live, awards]: [EventLive | null, TbaAward[] | null] = comp.tbaEventKey && tba
    ? await Promise.all([loadEventLive(tba, team.teamNumber, comp.tbaEventKey), tba.teamEventAwards(team.teamNumber, comp.tbaEventKey)])
    : [null, null];
  const tz = isValidTimezone(live?.event?.timezone) ? live!.event!.timezone! : teamTz;
  const year = comp.season.year;
  const isHeadMentor = session.user.roles.includes("HEAD_MENTOR" as never);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {when === "live" && live && <AutoRefresh />}
      <div>
        <nav className="text-small text-(--color-text-secondary) mb-1">
          <Link href="/competitions" className="hover:text-(--color-primary)">Competitions</Link>
          <span className="mx-2">›</span>{designation(comp.stage, comp.stageNumber)}
        </nav>
        <PageTitle help="competitions" share={<ShareButton path={`/competitions/${comp.id}`} title={comp.name} />}>{comp.name}</PageTitle>
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

      {/* Not at the event? Snooze alerts rather than turning them off */}
      {when !== "after" && comp.tbaEventKey && (
        <SnoozeAlerts until={me?.competitionSnoozeUntil?.toISOString() ?? null} eventOn={when === "live"} />
      )}

      {awards && awards.length > 0 && (
        <div className="card border-l-4 border-l-(--color-warning) text-sm text-(--color-text-primary)">🏅 {awards.map((a) => a.name).join(" · ")}</div>
      )}

      {live && <EventDetails live={live} tz={tz} when={when} />}

      {comp.tbaEventKey && !tba && (
        <p className="text-small text-(--color-text-secondary)">
          The schedule and results show here once the team connects The Blue Alliance (a Head Mentor or Integration Admin, in Settings → Integrations). Until then, the links below have everything.
        </p>
      )}

      <FollowAlong team={team.teamNumber} eventKey={comp.tbaEventKey} year={year} streams={live?.streams ?? []} />
      <EventExplainer team={team.teamNumber} />
    </div>
  );
}
