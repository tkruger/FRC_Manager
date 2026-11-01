// At the start of each meeting: a push to everyone it's for who has open tasks, listing them —
// so students walk in knowing what to work on. Runs from the 5-minute job; each person hears
// once per meeting. Server-only.

import { prisma } from "@/lib/prisma";
import { withImpliedRoles } from "@/lib/rbac";
import { invitedTo, meetingName } from "@/lib/meeting-audience";
import { calendarDayKey, FALLBACK_TIMEZONE, isValidTimezone, zonedTimeToUtc } from "./time";
import { notifyUsers } from "./deliver";
import { claimOnce } from "./claim";

/** Sent from the meeting's start until this long after (the job can run late) */
const WINDOW_MS = 30 * 60_000;
const MAX_LISTED = 5;

const DUE = (d: Date) => d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

export async function meetingStartTasks(now = new Date()): Promise<{ meetings: number; sent: number }> {
  // Meetings on yesterday's, today's or tomorrow's date (UTC) — narrowed by each team's clock below
  const day = 86_400_000;
  const meetings = await prisma.meeting.findMany({
    where: {
      cancelled: false,
      date: { gte: new Date(now.getTime() - 2 * day), lte: new Date(now.getTime() + day) },
      season: { isActive: true },
    },
    select: {
      id: true, date: true, startTime: true, endTime: true, title: true, subTeam: true, seasonId: true,
      season: { select: { team: { select: { id: true, timezone: true } } } },
    },
  });

  let started = 0, sent = 0;
  for (const mt of meetings) {
    const team = mt.season.team;
    const tz = isValidTimezone(team.timezone) ? team.timezone : FALLBACK_TIMEZONE;
    const [y, mo, d] = calendarDayKey(mt.date).split("-").map(Number);
    const [hh, mm] = mt.startTime.split(":").map(Number);
    const start = zonedTimeToUtc(y, mo, d, hh, mm, tz);
    const since = now.getTime() - start.getTime();
    if (since < 0 || since > WINDOW_MS) continue;
    started++;

    // Everyone it's for, with their open tasks this season
    const users = await prisma.user.findMany({
      where:  { teamId: team.id, status: "ACTIVE", deletedAt: null },
      select: { id: true, subTeams: true, roles: { select: { role: true } } },
    });
    const invited = users.filter((u) => invitedTo(mt, { roles: withImpliedRoles(u.roles.map((r) => r.role)), subTeams: u.subTeams }));
    if (invited.length === 0) continue;
    const tasks = await prisma.task.findMany({
      where:   { seasonId: mt.seasonId, status: { not: "COMPLETE" }, assignees: { some: { id: { in: invited.map((u) => u.id) } } } },
      orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { name: "asc" }],
      select:  { name: true, status: true, dueDate: true, assignees: { select: { id: true } } },
    });

    for (const u of invited) {
      const mine = tasks.filter((t) => t.assignees.some((a) => a.id === u.id));
      if (mine.length === 0) continue;
      if (!(await claimOnce(`mstart:${mt.id}:${u.id}`))) continue;
      const listed = mine.slice(0, MAX_LISTED).map((t) =>
        `${t.status === "BLOCKED" ? "⛔ " : ""}${t.name}${t.dueDate ? ` (due ${DUE(t.dueDate)})` : ""}`);
      const more = mine.length - listed.length;
      await notifyUsers([u.id], {
        topic: "tasks.meeting_start",
        type:  "MEETING_TASKS",
        title: `🛠️ ${meetingName(mt)} is starting — you have ${mine.length} open task${mine.length === 1 ? "" : "s"}`,
        body:  listed.join(" · ") + (more > 0 ? ` · and ${more} more` : ""),
        url:   "/tasks",
        tag:   `mstart-${mt.id}`,
        ttl:   2 * 60 * 60,
      });
      sent++;
    }
  }
  return { meetings: started, sent };
}
