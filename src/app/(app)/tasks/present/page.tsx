import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calendarDayKey, FALLBACK_TIMEZONE, isValidTimezone, localParts } from "@/lib/notify/time";
import { TaskBoardPresenter, type PresenterTask, type PresenterEvent } from "./TaskBoardPresenter";

// The task board on a TV (16:9, 1080p): the Kanban board and an 11-day timeline (today on the
// left, the next 10 days to the right). It refreshes itself every minute, so it rolls forward
// with the days and picks up changes as people work.

export const dynamic = "force-dynamic";

/** Days shown: today and the next 10 */
const DAYS = 11;

function addDays(key: string, n: number) {
  return new Date(Date.parse(`${key}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
}

export default async function PresentTasksPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const { show } = await searchParams;
  const session = await auth();
  if (!session?.user?.teamId) redirect("/dashboard");

  const [team, season] = await Promise.all([
    prisma.team.findUnique({ where: { id: session.user.teamId }, select: { teamNumber: true, timezone: true } }),
    prisma.season.findFirst({
      where:  { teamId: session.user.teamId, isActive: true },
      select: {
        id: true, name: true,
        competitionEvents: { select: { name: true, startDate: true, endDate: true } },
      },
    }),
  ]);
  if (!season) redirect("/settings/season");

  const tz = isValidTimezone(team?.timezone) ? team!.timezone! : FALLBACK_TIMEZONE;
  const now = localParts(new Date(), tz);
  const today = now.dateKey;
  const last = addDays(today, DAYS - 1);

  const tasks = await prisma.task.findMany({
    where:  { seasonId: season.id, isTemplateTask: false },
    select: {
      id: true, name: true, subTeam: true, status: true, priority: true, isMilestone: true,
      startDate: true, dueDate: true, completionDate: true,
      assignees: { select: { name: true } },
    },
  });

  const rows: PresenterTask[] = tasks.map((t) => ({
    id: t.id,
    name: t.name,
    subTeam: t.subTeam,
    status: t.status,
    priority: t.priority,
    milestone: t.isMilestone,
    start: t.startDate ? calendarDayKey(t.startDate) : null,
    due: t.dueDate ? calendarDayKey(t.dueDate) : null,
    // Completion is a moment; the day it happened in the team's time zone
    done: t.completionDate ? localParts(t.completionDate, tz).dateKey : null,
    people: t.assignees.map((a) => a.name.split(" ")[0]),
  }));

  const events: PresenterEvent[] = season.competitionEvents
    .map((e) => ({ name: e.name, start: calendarDayKey(e.startDate), end: calendarDayKey(e.endDate ?? e.startDate) }))
    .filter((e) => e.end >= today && e.start <= last);

  return (
    <TaskBoardPresenter
      teamNumber={team?.teamNumber ?? null}
      seasonName={season.name}
      today={today}
      days={Array.from({ length: DAYS }, (_, i) => addDays(today, i))}
      tasks={rows}
      events={events}
      show={show === "board" || show === "timeline" ? show : "both"}
      timeZone={tz}
    />
  );
}
