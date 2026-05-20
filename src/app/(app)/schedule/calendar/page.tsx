import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CalendarClient } from "./CalendarClient";
import { SubscribeCalendarButton } from "@/components/calendar/SubscribeCalendarButton";
import { GenerateShareLinkButton } from "./GenerateShareLinkButton";

export default async function CalendarPage() {
  const session = await auth();
  if (!session?.user?.teamId) redirect("/dashboard");

  const activeSeason = await prisma.season.findFirst({
    where: { teamId: session.user.teamId, isActive: true },
    include: {
      meetings: {
        orderBy: { date: "asc" },
        include: { tasks: { select: { id: true, name: true, status: true, subTeam: true } } },
      },
    },
  });

  if (!activeSeason) redirect("/settings/season");

  const isLeadership = session.user.roles.some((r) =>
    ["HEAD_MENTOR", "TEAM_LEADERSHIP", "BUILD_LEAD"].includes(r)
  );

  const allTasks = isLeadership
    ? await prisma.task.findMany({
        where: { seasonId: activeSeason.id },
        select: { id: true, name: true, status: true, subTeam: true, dueDate: true },
        orderBy: { name: "asc" },
      })
    : [];

  const baseUrl = process.env.NEXTAUTH_URL ?? "https://frc-manager.vercel.app";
  const calendarUrl = activeSeason.calendarToken
    ? `${baseUrl}/api/calendar/${activeSeason.calendarToken}.ics`
    : null;
  const publicUrl = activeSeason.calendarToken
    ? `${baseUrl}/public/schedule/${activeSeason.calendarToken}`
    : null;

  return (
    <div className="py-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between px-4 sm:px-6 lg:px-8">
        <div>
          <nav className="text-small text-[--color-text-secondary] mb-1">
            <Link href="/schedule" className="hover:text-[--color-primary]">Schedule</Link>
            <span className="mx-2">›</span>Calendar
          </nav>
          <h1 className="text-h1 text-[--color-text-primary]">Meeting Calendar</h1>
          <p className="text-body text-[--color-text-secondary] mt-1">{activeSeason.name}</p>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          {/* Share / subscribe buttons */}
          {calendarUrl
            ? <SubscribeCalendarButton icsUrl={calendarUrl} />
            : isLeadership && <GenerateShareLinkButton seasonId={activeSeason.id} />}
          {publicUrl && (
            <Link href={publicUrl} target="_blank">
              <Button variant="outline" size="sm">Public view ↗</Button>
            </Link>
          )}
          <Link href="/schedule/tasks/new">
            <Button size="sm">+ New task</Button>
          </Link>
        </div>
      </div>

      <CalendarClient
        season={{
          id:            activeSeason.id,
          name:          activeSeason.name,
          kickoffDate:   activeSeason.kickoffDate.toISOString(),
          week0Date:     activeSeason.week0Date.toISOString(),
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
        }))}
        allTasks={allTasks.map((t) => ({
          id:      t.id,
          name:    t.name,
          status:  t.status,
          subTeam: t.subTeam,
          dueDate: t.dueDate?.toISOString() ?? null,
        }))}
        isLeadership={isLeadership}
        nextauthUrl={baseUrl}
      />
    </div>
  );
}
