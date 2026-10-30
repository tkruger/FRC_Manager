// The Audit log's data: what's shown for a date range and filter. Shared by the page and its
// CSV export so both always cover the same rows. Server-only.

import { prisma } from "@/lib/prisma";
import { localParts, zonedTimeToUtc, FALLBACK_TIMEZONE, isValidTimezone } from "@/lib/notify/time";

export const SHOWS = {
  all:      "Everything",
  tools:    "Tool check-outs and check-ins",
  safety:   "Safety reports",
  changes:  "Changes to orders, tasks, meetings and members",
  order:    "Changes to orders",
  task:     "Changes to tasks",
  meeting:  "Changes to meetings",
  member:   "Changes to members",
} as const;
export type Show = keyof typeof SHOWS;

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const CHANGE_TYPES = ["order", "task", "meeting", "member"] as const;

export function addDays(key: string, n: number) {
  return new Date(Date.parse(key) + n * 86_400_000).toISOString().slice(0, 10);
}

export interface AuditRange {
  tz: string;
  today: string;
  /** Local calendar days, inclusive */
  from: string;
  to: string;
  /** The same as instants: start inclusive, end exclusive */
  start: Date;
  end: Date;
  show: Show;
  showTools: boolean;
  showSafety: boolean;
  showChanges: boolean;
}

/** The range and filter from the page's query (default: the last 30 days, everything) */
export function auditRange(sp: { from?: string | null; to?: string | null; show?: string | null }, timezone: string | null | undefined): AuditRange {
  const tz = isValidTimezone(timezone) ? timezone : FALLBACK_TIMEZONE;
  const today = localParts(new Date(), tz).dateKey;
  let to   = sp.to && DAY.test(sp.to) ? sp.to : today;
  let from = sp.from && DAY.test(sp.from) ? sp.from : addDays(to, -29);
  if (from > to) [from, to] = [to, from];
  const show: Show = sp.show && sp.show in SHOWS ? (sp.show as Show) : "all";
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = addDays(to, 1).split("-").map(Number);
  return {
    tz, today, from, to, show,
    start: zonedTimeToUtc(fy, fm, fd, 0, 0, tz),
    end:   zonedTimeToUtc(ty, tm, td, 0, 0, tz),
    showTools:   show === "all" || show === "tools",
    showSafety:  show === "all" || show === "safety",
    showChanges: show === "all" || show === "changes" || (CHANGE_TYPES as readonly string[]).includes(show),
  };
}

/** Tool check-outs/ins, safety reports and changes in the range (changes newest first, up to `changeLimit`) */
export async function loadAudit(teamId: string, r: AuditRange, changeLimit: number) {
  const [checkouts, incidents, changeRows] = await Promise.all([
    !r.showTools ? [] : prisma.toolCheckout.findMany({
      where: {
        tool: { teamId },
        OR: [{ checkedOutAt: { gte: r.start, lt: r.end } }, { returnedAt: { gte: r.start, lt: r.end } }],
      },
      include: {
        tool: { select: { name: true, assetTag: true } },
        user: { select: { name: true } },
      },
    }),
    !r.showSafety ? [] : prisma.safetyIncident.findMany({
      // Incident dates are calendar days (stored at UTC midnight)
      where:   { reportedBy: { teamId }, incidentDate: { gte: new Date(r.from), lt: new Date(addDays(r.to, 1)) } },
      include: { reportedBy: { select: { name: true } } },
      orderBy: [{ incidentDate: "asc" }, { createdAt: "asc" }],
    }),
    !r.showChanges ? [] : prisma.changeLog.findMany({
      where: {
        teamId, createdAt: { gte: r.start, lt: r.end },
        ...((CHANGE_TYPES as readonly string[]).includes(r.show) ? { entityType: r.show } : {}),
      },
      orderBy: { createdAt: "desc" },
      take:    changeLimit + 1,
      include: { actor: { select: { name: true, deletedAt: true } } },
    }),
  ]);

  // One event per check-out and per check-in that falls in the range, oldest first
  const events: { at: Date; kind: "out" | "in"; c: (typeof checkouts)[number] }[] = [];
  for (const c of checkouts) {
    if (c.checkedOutAt >= r.start && c.checkedOutAt < r.end) events.push({ at: c.checkedOutAt, kind: "out", c });
    if (c.returnedAt && c.returnedAt >= r.start && c.returnedAt < r.end) events.push({ at: c.returnedAt, kind: "in", c });
  }
  events.sort((a, b) => a.at.getTime() - b.at.getTime() || (a.kind === "out" ? -1 : 1));

  return { checkouts, events, incidents, changeRows: changeRows.slice(0, changeLimit), moreChanges: changeRows.length > changeLimit };
}
