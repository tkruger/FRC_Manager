import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageTitle } from "@/components/PageHeader";
import { EVENT_KEY } from "@/lib/frc/links";
import { tbaFor } from "@/lib/frc/team-keys";
import { eventWindow, loadEventLive } from "@/lib/frc/event-live";
import { FALLBACK_TIMEZONE, isValidTimezone, localParts } from "@/lib/notify/time";
import { EventDetails } from "@/components/competitions/EventDetails";
import { FollowAlong } from "@/components/competitions/parts";

const DAY = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

/** Any event the team played, straight from The Blue Alliance (past seasons in the history) */
export default async function TbaEventPage({ params }: { params: Promise<{ key: string }> }) {
  const { key: raw } = await params;
  const key = raw.toLowerCase();
  if (!EVENT_KEY.test(key)) notFound();
  const session = await auth();
  if (!session?.user?.teamId) redirect("/dashboard");

  // A competition in the app linked to this event has its own page
  const [linked, team] = await Promise.all([
    prisma.competitionEvent.findFirst({ where: { tbaEventKey: key, season: { teamId: session.user.teamId } }, select: { id: true } }),
    prisma.team.findUnique({ where: { id: session.user.teamId }, select: { teamNumber: true, timezone: true } }),
  ]);
  if (linked) redirect(`/competitions/${linked.id}`);
  if (!team) redirect("/dashboard");
  const tba = await tbaFor(session.user.teamId);
  if (!tba) redirect("/competitions/history");

  const [live, awards] = await Promise.all([loadEventLive(tba, team.teamNumber, key), tba.teamEventAwards(team.teamNumber, key)]);
  if (!live.event) notFound();
  const ev = live.event;
  const teamTz = isValidTimezone(team.timezone) ? team.timezone! : FALLBACK_TIMEZONE;
  const tz = isValidTimezone(ev.timezone) ? ev.timezone! : teamTz;
  const when = eventWindow(localParts(new Date(), teamTz).dateKey, new Date(`${ev.start_date}T00:00:00Z`), new Date(`${ev.end_date}T00:00:00Z`));

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div>
        <nav className="text-small text-(--color-text-secondary) mb-1">
          <Link href="/competitions" className="hover:text-(--color-primary)">Competitions</Link><span className="mx-2">›</span>
          <Link href="/competitions/history" className="hover:text-(--color-primary)">History</Link><span className="mx-2">›</span>
          <Link href={`/competitions/history/${ev.year}`} className="hover:text-(--color-primary)">{ev.year}</Link>
        </nav>
        <PageTitle help="competitions">{ev.name}</PageTitle>
        <p className="mt-1 text-sm text-(--color-text-secondary)">
          {DAY(ev.start_date)}{ev.end_date !== ev.start_date && ` – ${DAY(ev.end_date)}`}
          {` · ${[ev.location_name, ev.city, ev.state_prov].filter(Boolean).join(", ")}`}
        </p>
      </div>

      {awards && awards.length > 0 && (
        <div className="card border-l-4 border-l-(--color-warning) text-sm text-(--color-text-primary)">🏅 {awards.map((a) => a.name).join(" · ")}</div>
      )}

      <EventDetails live={live} tz={tz} when={when} />

      <FollowAlong team={team.teamNumber} eventKey={key} year={ev.year} streams={live.streams} />
    </div>
  );
}
