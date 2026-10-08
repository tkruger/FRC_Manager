// Event-driven notifications: called from server actions when something happens.
// All best-effort — a failed notification never fails the action. Server-only.

import { prisma } from "@/lib/prisma";
import { notifyUsers, notifyRoles } from "./deliver";
import { calendarDayKey } from "./time";

function safely(fn: () => Promise<unknown>) {
  return fn().catch((e) => console.error("[notify]", e));
}

function meetingLabel(m: { date: Date; startTime: string; endTime: string; title: string | null }) {
  const day = new Date(`${calendarDayKey(m.date)}T12:00:00Z`)
    .toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
  return `${m.title ? `${m.title} — ` : ""}${day}, ${m.startTime}–${m.endTime}`;
}

export function meetingChanged(
  meetingId: string,
  kind: "added" | "moved" | "cancelled" | "restored",
  actorId: string,
) {
  return safely(async () => {
    const m = await prisma.meeting.findUnique({
      where:  { id: meetingId },
      select: { date: true, startTime: true, endTime: true, title: true, cancelReason: true, season: { select: { teamId: true } } },
    });
    // Don't announce changes to meetings that have already happened
    if (!m || calendarDayKey(m.date) < calendarDayKey(new Date())) return;

    const title = {
      added:     "New meeting scheduled",
      moved:     "Meeting changed",
      cancelled: "Meeting canceled",
      restored:  "Meeting back on",
    }[kind];
    await notifyRoles(m.season.teamId, "all", {
      topic: "meetings.changes",
      type:  "MEETING_CHANGED",
      title: `${kind === "cancelled" ? "❌ " : "📅 "}${title}`,
      body:  `${meetingLabel(m)}${kind === "cancelled" && m.cancelReason ? ` · ${m.cancelReason}` : ""}`,
      url:   "/calendar",
      tag:   `meeting-${meetingId}`,
    }, { exclude: [actorId] });
  });
}

export function meetingsPublished(teamId: string, count: number, actorId: string) {
  return safely(() => notifyRoles(teamId, "all", {
    topic: "meetings.changes",
    type:  "MEETING_CHANGED",
    title: "📅 Meeting schedule published",
    body:  `${count} meetings added to the calendar.`,
    url:   "/calendar",
  }, { exclude: [actorId] }));
}

export function taskAssigned(taskId: string, userIds: string[], actorId: string) {
  const recipients = userIds.filter((id) => id !== actorId);
  if (recipients.length === 0) return Promise.resolve();
  return safely(async () => {
    const t = await prisma.task.findUnique({ where: { id: taskId }, select: { name: true, dueDate: true } });
    if (!t) return;
    await notifyUsers(recipients, {
      topic: "tasks.assigned",
      type:  "TASK_ASSIGNED",
      title: `You were assigned: ${t.name}`,
      body:  t.dueDate ? `Due ${calendarDayKey(t.dueDate)}` : undefined,
      url:   "/tasks",
    });
  });
}

export function taskBlocked(taskId: string, actorId: string) {
  return safely(async () => {
    const t = await prisma.task.findUnique({
      where:  { id: taskId },
      select: { name: true, blockersNotes: true, season: { select: { teamId: true } }, assignees: { select: { id: true } } },
    });
    if (!t) return;
    const n = {
      topic: "tasks.blocked" as const,
      type:  "TASK_BLOCKED" as const,
      title: `🚧 Task blocked: ${t.name}`,
      body:  t.blockersNotes ?? undefined,
      url:   "/tasks",
    };
    const leads = await prisma.user.findMany({
      where:  { teamId: t.season.teamId, status: "ACTIVE", roles: { some: { role: { in: ["BUILD_LEAD", "HEAD_MENTOR"] } } } },
      select: { id: true },
    });
    const ids = [...t.assignees.map((a) => a.id), ...leads.map((l) => l.id)].filter((id) => id !== actorId);
    await notifyUsers(ids, n);
  });
}

export function memberAwaitingApproval(teamId: string, name: string) {
  return safely(() => notifyRoles(teamId, ["HEAD_MENTOR", "TEAM_LEADERSHIP"], {
    topic: "members.approval_needed",
    type:  "MEMBER_APPROVAL_NEEDED",
    title: `${name} wants to join the team`,
    body:  "Review their registration in Team members.",
    url:   "/settings/members",
  }));
}

export function safetyIncidentFiled(teamId: string, severity: string, reporterId: string) {
  return safely(() => notifyRoles(teamId, ["SAFETY_CAPTAIN", "HEAD_MENTOR"], {
    topic: "safety.incident",
    type:  "SAFETY_INCIDENT",
    title: `⚠️ Safety incident reported (${severity.replace(/_/g, " ").toLowerCase()})`,
    url:   "/safety/incidents",
    bypassQuietHours: severity === "SIGNIFICANT_INJURY",
  }, { exclude: [reporterId] }));
}

// ── Platform ────────────────────────────────────────────────────────────────

/** A team that's new to FRC Manager registered — every super admin can approve it */
export function teamAwaitingApproval(teamNumber: number, founderName: string) {
  return safely(async () => {
    const admins = await prisma.user.findMany({ where: { isSuperAdmin: true, status: "ACTIVE" }, select: { id: true } });
    await notifyUsers(admins.map((a) => a.id), {
      topic: "admin.team_requests",
      type:  "TEAM_APPROVAL_NEEDED",
      title: `New team to approve: ${teamNumber}`,
      body:  `${founderName} registered team ${teamNumber}.`,
      url:   "/settings/admin",
    });
  });
}

/** The team was approved: its founder can sign in as Head Mentor */
export function teamApproved(founderId: string, teamNumber: number) {
  return safely(() => notifyUsers([founderId], {
    topic: "account",
    type:  "ACCOUNT_APPROVED",
    title: `Team ${teamNumber} is approved`,
    body:  "You're the team's Head Mentor — invite your team and approve them in Team members.",
    url:   "/settings/members",
  }));
}
