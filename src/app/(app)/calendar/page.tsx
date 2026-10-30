import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { canCoordinate, DEFAULT_MIN_ADULTS, isAdult, isCleared } from "@/lib/volunteers";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CalendarClient } from "./CalendarClient";
import { SubscribeCalendarButton } from "@/components/calendar/SubscribeCalendarButton";
import { GenerateShareLinkButton } from "./GenerateShareLinkButton";
import { PageHeader } from "@/components/PageHeader";
import { appUrl } from "@/lib/app-url";
import { kickoffOf } from "@/lib/competition";

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ meeting?: string }> }) {
  const { meeting: openMeetingId } = await searchParams;
  const session = await auth();
  if (!session?.user?.teamId) redirect("/dashboard");

  const activeSeason = await prisma.season.findFirst({
    where: { teamId: session.user.teamId, isActive: true },
    include: {
      meetings: {
        orderBy: { date: "asc" },
        include: {
          tasks: { select: { id: true, name: true, status: true, subTeam: true } },
          volunteers: { orderBy: { createdAt: "asc" }, select: { userId: true, status: true, user: { select: { name: true } } } },
        },
      },
    },
  });

  if (!activeSeason) redirect("/settings/season");

  // Volunteers: adults and coordinators see each meeting's coverage
  const roles = session.user.roles as string[];
  const [volunteerSettings, me] = await Promise.all([
    prisma.volunteerSettings.findUnique({ where: { teamId: session.user.teamId }, select: { minAdults: true } }),
    prisma.user.findUnique({ where: { id: session.user.id }, select: { volunteerClearedAt: true, volunteerClearedUntil: true } }),
  ]);
  const volunteerView = isAdult(roles) || canCoordinate(roles)
    ? { myId: session.user.id, cleared: !!me && isCleared(me), coordinating: canCoordinate(roles), minAdults: volunteerSettings?.minAdults ?? DEFAULT_MIN_ADULTS }
    : null;

  const isLeadership = session.user.roles.some((r) =>
    ["HEAD_MENTOR", "TEAM_LEADERSHIP", "BUILD_LEAD"].includes(r)
  );

  const calendarTasks = isLeadership
    ? await prisma.task.findMany({
        where: { seasonId: activeSeason.id },
        select: { id: true, name: true, status: true, subTeam: true, dueDate: true },
        orderBy: { name: "asc" },
      })
    : [];

  const baseUrl = appUrl();
  const calendarUrl = activeSeason.calendarToken
    ? `${baseUrl}/api/calendar/${activeSeason.calendarToken}.ics`
    : null;
  const publicUrl = activeSeason.calendarToken
    ? `${baseUrl}/public/schedule/${activeSeason.calendarToken}`
    : null;

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
      {/* Header */}
      <PageHeader
        title="Calendar"
        help="calendar"
        subtitle={<>{activeSeason.name} · {activeSeason.meetings.filter((m) => !m.cancelled).length} meetings</>}
        actions={<>
          {calendarUrl
            ? <SubscribeCalendarButton icsUrl={calendarUrl} />
            : <GenerateShareLinkButton seasonId={activeSeason.id} />}
          {publicUrl && (
            <Link href={publicUrl} target="_blank">
              <Button variant="outline" size="sm">Public view ↗</Button>
            </Link>
          )}
        </>}
      />

      <CalendarClient
        season={{
          id:            activeSeason.id,
          name:          activeSeason.name,
          startDate:     activeSeason.startDate.toISOString(),
          kickoffDate:   kickoffOf(activeSeason).toISOString(),
          endDate:     activeSeason.endDate.toISOString(),
          meetingDays:   activeSeason.meetingDays,
          calendarToken: activeSeason.calendarToken,
        }}
        meetings={activeSeason.meetings.map((m) => ({
          id:           m.id,
          date:         m.date.toISOString(),
          startTime:    m.startTime,
          endTime:      m.endTime,
          title:        m.title,
          notes:        m.notes,
          cancelled:    m.cancelled,
          cancelReason: m.cancelReason,
          tasks:        m.tasks,
          volunteers:   m.volunteers.map((v) => ({ userId: v.userId, name: v.user.name, status: v.status })),
        }))}
        volunteerView={volunteerView}
        allTasks={calendarTasks.map((t) => ({
          id:      t.id,
          name:    t.name,
          status:  t.status,
          subTeam: t.subTeam,
          dueDate: t.dueDate?.toISOString() ?? null,
        }))}
        isLeadership={isLeadership}
        nextauthUrl={baseUrl}
        openMeetingId={openMeetingId}
      />
    </div>
  );
}

