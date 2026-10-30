import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageTitle } from "@/components/PageHeader";
import { FALLBACK_TIMEZONE, isValidTimezone, localParts } from "@/lib/notify/time";
import { canCoordinate, clearanceDaysLeft, DEFAULT_MIN_ADULTS, isAdult, isCleared, shiftWhen } from "@/lib/volunteers";
import { VolunteersClient, type AdultRow, type MeetingRow } from "./VolunteersClient";

// Volunteers: cleared adults sign up to cover meetings; coordinators make sure every meeting
// has enough confirmed adults.

/** How far ahead meetings are listed */
const WEEKS_AHEAD = 8;

export default async function VolunteersPage({ searchParams }: { searchParams: Promise<{ meeting?: string }> }) {
  const { meeting: focusId } = await searchParams;
  const session = await auth();
  if (!session?.user?.teamId) redirect("/dashboard");
  const teamId = session.user.teamId;
  const roles = session.user.roles as string[];
  const coordinating = canCoordinate(roles);

  const [team, me, season] = await Promise.all([
    prisma.team.findUnique({ where: { id: teamId }, select: { timezone: true, volunteerSettings: { select: { instructions: true, minAdults: true } } } }),
    prisma.user.findUnique({ where: { id: session.user.id }, select: { volunteerClearedAt: true, volunteerClearedUntil: true, phone: true } }),
    prisma.season.findFirst({ where: { teamId, isActive: true }, select: { id: true, name: true } }),
  ]);
  const tz = isValidTimezone(team?.timezone) ? team!.timezone! : FALLBACK_TIMEZONE;
  const todayKey = localParts(new Date(), tz).dateKey;
  const from = new Date(`${todayKey}T00:00:00Z`);
  const to = new Date(from.getTime() + WEEKS_AHEAD * 7 * 86_400_000);
  const minAdults = team?.volunteerSettings?.minAdults ?? DEFAULT_MIN_ADULTS;

  const [meetings, adults] = await Promise.all([
    season ? prisma.meeting.findMany({
      where:   { seasonId: season.id, cancelled: false, date: { gte: from, lt: to } },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
      select: {
        id: true, date: true, startTime: true, endTime: true, title: true,
        volunteerNote: { select: { instructions: true } },
        volunteers: { orderBy: { createdAt: "asc" }, select: { userId: true, status: true, user: { select: { name: true, phone: true } } } },
      },
    }) : [],
    coordinating ? prisma.user.findMany({
      where:   { teamId, status: "ACTIVE", deletedAt: null },
      orderBy: { name: "asc" },
      select: {
        id: true, name: true, email: true, phone: true, volunteerClearedAt: true, volunteerClearedUntil: true,
        roles: { select: { role: true } },
        volunteerShifts: { where: { status: "CONFIRMED", meeting: { date: { gte: from }, cancelled: false } }, select: { id: true } },
      },
    }) : [],
  ]);

  const rows: MeetingRow[] = meetings.map((m) => ({
    id: m.id,
    when: shiftWhen(m),
    title: m.title,
    instructions: m.volunteerNote?.instructions ?? null,
    volunteers: m.volunteers.map((v) => ({
      userId: v.userId, name: v.user.name, status: v.status,
      // Phone numbers only for coordinators
      phone: coordinating ? v.user.phone : null,
    })),
  }));

  const adultRows: AdultRow[] = adults
    .filter((u) => u.volunteerClearedAt || isAdult(u.roles.map((r) => r.role)))
    .map((u) => ({
      id: u.id, name: u.name, email: u.email.endsWith(".invalid") ? null : u.email, phone: u.phone,
      cleared: isCleared(u),
      until: u.volunteerClearedUntil?.toISOString() ?? null,
      daysLeft: clearanceDaysLeft(u.volunteerClearedUntil),
      lapsed: !!u.volunteerClearedAt && !isCleared(u),
      upcoming: u.volunteerShifts.length,
    }));

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div>
        <PageTitle help="volunteers">Volunteers</PageTitle>
        <p className="text-body text-(--color-text-secondary) mt-1">
          Every meeting needs at least {minAdults} confirmed adult{minAdults === 1 ? "" : "s"}. {season ? `${season.name} · the next ${WEEKS_AHEAD} weeks.` : "There's no active season yet."}
        </p>
      </div>

      <VolunteersClient
        me={{ id: session.user.id, cleared: !!me && isCleared(me), adult: isAdult(roles), clearedUntil: me?.volunteerClearedUntil?.toISOString() ?? null, hasPhone: !!me?.phone }}
        coordinating={coordinating}
        isHeadMentor={roles.includes("HEAD_MENTOR")}
        minAdults={minAdults}
        defaultInstructions={team?.volunteerSettings?.instructions ?? null}
        meetings={rows}
        adults={adultRows}
        focusId={focusId ?? null}
      />
    </div>
  );
}
