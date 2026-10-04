// Scheduled reminders, run hourly by /api/cron/notifications. Server-only.
//
// Each check produces "candidates" with a stable key. ReminderLog remembers when a
// key last fired, so re-running the job (or running it late) never double-sends.
// Reminders are held back during each person's quiet hours and retried next run.

import { prisma } from "@/lib/prisma";
import type { Role } from "@/generated/prisma";
import { notifyUsers, type OutgoingNotification } from "./deliver";
import {
  FALLBACK_TIMEZONE, DAILY_DIGEST_HOUR, calendarDayKey, daysUntil, inQuietHours,
  isValidTimezone, localParts, zonedTimeToUtc, type LocalParts,
} from "./time";
import { definitionFor, resolveCurrentStep } from "@/lib/workflow/engine";

const HOUR = 3_600_000;
/** Cron drift allowance so an "every 3h" reminder doesn't slip to 4h */
const SLACK = 10 * 60_000;
export const COUNTDOWN_DAYS = 30;

interface Member {
  id:     string;
  roles:  Role[];
  tz:     string;
  local:  LocalParts;
  quiet:  boolean;
  /** Morning digest window: at/after 8am local and outside quiet hours */
  dailySlot: boolean;
}

interface Candidate {
  key:      string;
  /** Repeat interval; omit for one-shot reminders */
  everyMs?: number;
  /** For repeating reminders that haven't fired yet: count the interval from here */
  since?:   Date;
  userId:   string;
  n:        OutgoingNotification;
}

export interface ReminderRunResult {
  teams:      number;
  candidates: number;
  sent:       number;
  pushed:     number;
}

export async function runReminders(now = new Date()): Promise<ReminderRunResult> {
  const teams = await prisma.team.findMany({
    where:  { seasons: { some: { isActive: true } } },
    select: {
      id: true, timezone: true,
      seasons: { where: { isActive: true }, select: { id: true }, take: 1 },
      users: {
        where:  { status: "ACTIVE" },
        select: { id: true, timezone: true, quietHoursStart: true, quietHoursEnd: true, roles: { select: { role: true } } },
      },
    },
  });

  const candidates: Candidate[] = [];
  for (const team of teams) {
    const seasonId = team.seasons[0]?.id;
    if (!seasonId) continue;
    const teamTz = isValidTimezone(team.timezone) ? team.timezone : FALLBACK_TIMEZONE;

    const members: Member[] = team.users.map((u) => {
      const tz    = isValidTimezone(u.timezone) ? u.timezone : teamTz;
      const local = localParts(now, tz);
      const quiet = inQuietHours(local.hour, u.quietHoursStart, u.quietHoursEnd);
      return { id: u.id, roles: u.roles.map((r) => r.role), tz, local, quiet, dailySlot: !quiet && local.hour >= DAILY_DIGEST_HOUR };
    });
    const awake = members.filter((m) => !m.quiet);

    candidates.push(
      ...await purchaseReminders(seasonId, awake, now),
      ...await meetingReminders(seasonId, teamTz, awake, now),
      ...await taskDigests(seasonId, awake.filter((m) => m.dailySlot)),
      ...await competitionCountdowns(seasonId, awake.filter((m) => m.dailySlot)),
      ...await toolReminders(team.id, members, now),
      ...await certReminders(awake.filter((m) => m.dailySlot)),
    );
  }

  // Decide which candidates are due, using one query for all their history
  const logs = new Map(
    (await prisma.reminderLog.findMany({ where: { key: { in: candidates.map((c) => c.key) } } }))
      .map((l) => [l.key, l]),
  );
  const due = candidates.filter((c) => {
    const log = logs.get(c.key);
    if (!c.everyMs) return !log;
    const last = log?.lastSentAt ?? c.since ?? new Date(0);
    return now.getTime() - last.getTime() >= c.everyMs - SLACK;
  });

  let pushed = 0;
  for (const c of due) {
    const res = await notifyUsers([c.userId], c.n).catch((e) => {
      console.error("[reminders]", c.key, e);
      return null;
    });
    if (!res) continue;
    pushed += res.pushed;
    await prisma.reminderLog.upsert({
      where:  { key: c.key },
      create: { key: c.key, lastSentAt: now },
      update: { lastSentAt: now, count: { increment: 1 } },
    });
  }

  return { teams: teams.length, candidates: candidates.length, sent: due.length, pushed };
}

// ── Purchasing: nag whoever a request is waiting on ─────────────────────────

async function purchaseReminders(seasonId: string, awake: Member[], now: Date): Promise<Candidate[]> {
  const open = await prisma.purchaseRequest.findMany({
    where:  { seasonId, status: { in: ["SUBMITTED", "APPROVED", "ORDERED", "PARTIAL_RECEIVED"] } },
    select: {
      id: true, title: true, status: true, priority: true, currentStepKey: true, workflowDefinitionId: true,
      requestedById: true, updatedAt: true, estimatedTotal: true,
      events: { where: { action: "entered" }, orderBy: { createdAt: "desc" }, take: 1, select: { stepKey: true, createdAt: true } },
    },
  });

  const out: Candidate[] = [];
  for (const r of open) {
    const def  = await definitionFor(r.workflowDefinitionId);
    const step = resolveCurrentStep(def, r);
    if (!step) continue;

    const urgent  = r.priority !== "ROUTINE";
    const everyMs = (urgent ? def.reminders.urgentHours : def.reminders.routineHours) * HOUR;
    const entered = r.events[0]?.stepKey === step.key ? r.events[0].createdAt : r.updatedAt;
    const ageH    = Math.floor((now.getTime() - entered.getTime()) / HOUR);
    const waited  = ageH >= 48 ? `${Math.floor(ageH / 24)} days` : `${ageH} hours`;
    const verb    = step.type === "approval" ? "approve or deny" : step.type === "order" ? "place the order" : "confirm delivery";

    for (const m of awake) {
      // Head Mentors can act on any step, but are only reminded about steps that list them
      if (!step.roles.some((role) => m.roles.includes(role))) continue;
      if (step.type === "approval" && step.allowSelfApproval === false && m.id === r.requestedById) continue;
      out.push({
        key: `purchase:${r.id}:${step.key}:${m.id}`,
        everyMs,
        since: entered,
        userId: m.id,
        n: {
          topic: "purchase.reminders",
          type:  "PURCHASE_REMINDER",
          title: `${r.priority === "EMERGENCY" ? "🚨 " : urgent ? "⏰ " : ""}Still waiting on you: "${r.title}"`,
          body:  `${step.name} — please ${verb}. Waiting ${waited}.`,
          url:   `/procurement/requests/${r.id}`,
          tag:   `purchase-${r.id}`,
        },
      });
    }
  }
  return out;
}

// ── Meetings: day-before and starting-soon ──────────────────────────────────

async function meetingReminders(seasonId: string, teamTz: string, awake: Member[], now: Date): Promise<Candidate[]> {
  const from = new Date(now.getTime() - 24 * HOUR);
  const to   = new Date(now.getTime() + 3 * 24 * HOUR);
  const meetings = await prisma.meeting.findMany({
    where:  { seasonId, cancelled: false, date: { gte: from, lte: to } },
    select: { id: true, date: true, startTime: true, endTime: true, title: true },
  });

  const out: Candidate[] = [];
  for (const mt of meetings) {
    const [y, mo, d] = calendarDayKey(mt.date).split("-").map(Number);
    const [hh, mm]   = mt.startTime.split(":").map(Number);
    const start      = zonedTimeToUtc(y, mo, d, hh, mm, teamTz);
    const msUntil    = start.getTime() - now.getTime();
    if (msUntil <= 0 || msUntil > 26 * HOUR) continue;

    const soon  = msUntil <= 2 * HOUR;
    const base  = `meeting:${mt.id}:${start.toISOString()}`;
    const when  = start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: teamTz });
    const what  = mt.title ?? "Team meeting";

    for (const m of awake) {
      const sameDay = localParts(start, teamTz).dateKey === m.local.dateKey;
      out.push({
        key:    `${base}:${soon ? "soon" : "day"}:${m.id}`,
        userId: m.id,
        n: {
          topic: "meetings.reminder",
          type:  "MEETING_REMINDER",
          title: soon ? `📅 ${what} starts at ${when}` : `📅 ${what} ${sameDay ? "today" : "tomorrow"} at ${when}`,
          body:  `${mt.startTime}–${mt.endTime}`,
          url:   "/calendar",
          tag:   `meeting-${mt.id}`,
        },
      });
    }
  }
  return out;
}

// ── Tasks: one morning digest per person ────────────────────────────────────

async function taskDigests(seasonId: string, morning: Member[]): Promise<Candidate[]> {
  if (morning.length === 0) return [];
  const tasks = await prisma.task.findMany({
    where: {
      seasonId,
      status:    { not: "COMPLETE" },
      dueDate:   { not: null },
      assignees: { some: { id: { in: morning.map((m) => m.id) } } },
    },
    select: { name: true, dueDate: true, assignees: { select: { id: true } } },
  });

  const out: Candidate[] = [];
  for (const m of morning) {
    const mine = tasks.filter((t) => t.assignees.some((a) => a.id === m.id));
    const overdue: string[] = [], today: string[] = [], tomorrow: string[] = [];
    for (const t of mine) {
      const d = daysUntil(m.local.dateKey, calendarDayKey(t.dueDate!));
      if (d < 0) overdue.push(t.name);
      else if (d === 0) today.push(t.name);
      else if (d === 1) tomorrow.push(t.name);
    }
    if (!overdue.length && !today.length && !tomorrow.length) continue;

    const parts = [
      overdue.length  && `${overdue.length} overdue`,
      today.length    && `${today.length} due today`,
      tomorrow.length && `${tomorrow.length} due tomorrow`,
    ].filter(Boolean);
    const names = [...overdue, ...today, ...tomorrow];
    out.push({
      key:    `tasks:${m.id}:${m.local.dateKey}`,
      userId: m.id,
      n: {
        topic: "tasks.due",
        type:  overdue.length ? "TASK_OVERDUE" : "TASK_DUE_SOON",
        title: `${overdue.length ? "⚠️" : "✅"} Your tasks: ${parts.join(", ")}`,
        body:  names.slice(0, 4).join(" · ") + (names.length > 4 ? ` +${names.length - 4} more` : ""),
        url:   "/tasks",
        tag:   "task-digest",
      },
    });
  }
  return out;
}

// ── Competitions: daily countdown ───────────────────────────────────────────

async function competitionCountdowns(seasonId: string, morning: Member[]): Promise<Candidate[]> {
  if (morning.length === 0) return [];
  const events = await prisma.competitionEvent.findMany({
    where:  { seasonId, endDate: { gte: new Date(Date.now() - 24 * HOUR) } },
    select: { id: true, name: true, location: true, startDate: true },
  });

  const out: Candidate[] = [];
  for (const ev of events) {
    for (const m of morning) {
      const d = daysUntil(m.local.dateKey, calendarDayKey(ev.startDate));
      if (d < 0 || d > COUNTDOWN_DAYS) continue;
      const title =
        d === 0 ? `🏁 Competition day! ${ev.name} starts today` :
        d === 1 ? `🏁 ${ev.name} is tomorrow` :
                  `🏁 ${d} days until ${ev.name}`;
      out.push({
        key:    `comp:${ev.id}:${m.local.dateKey}:${m.id}`,
        userId: m.id,
        n: {
          topic: "competitions.countdown",
          type:  "COMPETITION_COUNTDOWN",
          title,
          body:  d === 0 ? "Good luck, team!" : ev.location ?? undefined,
          url:   "/calendar",
          tag:   `comp-${ev.id}`,
        },
      });
    }
  }
  return out;
}

// ── Tools: due back today / overdue ─────────────────────────────────────────

async function toolReminders(teamId: string, members: Member[], now: Date): Promise<Candidate[]> {
  const byId = new Map(members.map((m) => [m.id, m]));
  const checkouts = await prisma.toolCheckout.findMany({
    where:  { returnedAt: null, tool: { teamId }, userId: { in: [...byId.keys()] } },
    select: { id: true, userId: true, expectedReturn: true, isOverdue: true, tool: { select: { name: true } } },
  });

  const out: Candidate[] = [];
  const newlyOverdue: string[] = [];
  for (const c of checkouts) {
    const m = byId.get(c.userId);
    if (!m) continue;
    const overdue = c.expectedReturn < now;
    if (overdue && !c.isOverdue) newlyOverdue.push(c.id);

    if (overdue && m.dailySlot) {
      out.push({
        key: `tool:${c.id}:overdue:${m.local.dateKey}`, userId: m.id,
        n: { topic: "tools.due", type: "TOOL_OVERDUE", title: `🔧 Overdue: please return ${c.tool.name}`, url: "/tools", tag: `tool-${c.id}` },
      });
    } else if (!overdue && !m.quiet && localParts(c.expectedReturn, m.tz).dateKey === m.local.dateKey) {
      out.push({
        key: `tool:${c.id}:due`, userId: m.id,
        n: { topic: "tools.due", type: "TOOL_DUE", title: `🔧 ${c.tool.name} is due back today`, url: "/tools", tag: `tool-${c.id}` },
      });
    }
  }
  if (newlyOverdue.length) {
    await prisma.toolCheckout.updateMany({ where: { id: { in: newlyOverdue } }, data: { isOverdue: true } });
  }
  return out;
}

// ── Certifications: 14 days, 3 days, expired ────────────────────────────────

const CERT_THRESHOLDS = [0, 3, 14];

async function certReminders(morning: Member[]): Promise<Candidate[]> {
  if (morning.length === 0) return [];
  const byId = new Map(morning.map((m) => [m.id, m]));
  const certs = await prisma.userCertification.findMany({
    where:  { userId: { in: [...byId.keys()] }, status: "ACTIVE", expiresAt: { not: null } },
    select: { id: true, userId: true, certName: true, expiresAt: true },
  });

  const out: Candidate[] = [];
  for (const c of certs) {
    const m = byId.get(c.userId)!;
    const d = daysUntil(m.local.dateKey, calendarDayKey(c.expiresAt!));
    // Only the tightest threshold reached, so a first run doesn't send three at once
    const threshold = CERT_THRESHOLDS.find((t) => d <= t);
    if (threshold === undefined || d < -7) continue;
    out.push({
      key:    `cert:${c.id}:${threshold}`,
      userId: c.userId,
      n: {
        topic: "certs.expiring",
        type:  "CERT_EXPIRING",
        title: d < 0 ? `🪪 Your ${c.certName} certification has expired`
             : d === 0 ? `🪪 Your ${c.certName} certification expires today`
             : `🪪 Your ${c.certName} certification expires in ${d} days`,
        url:   "/safety/certifications",
      },
    });
  }
  return out;
}
