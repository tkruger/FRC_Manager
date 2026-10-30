import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canSeeAudit } from "@/lib/packing";
import { csvCell } from "@/lib/csv";
import { calendarDayKey } from "@/lib/notify/time";
import { auditRange, loadAudit } from "@/lib/audit/report";
import { toHistoryEntries, ENTITY_LABELS } from "@/lib/audit/history";

// The Audit log as a spreadsheet: the same dates and filter as the page, one row per event
// (each changed field of a change gets its own row). Oldest first.

export const dynamic = "force-dynamic";

/** Most changes in one export */
const CHANGE_LIMIT = 20_000;

const SEVERITY: Record<string, string> = { SIGNIFICANT_INJURY: "Significant injury", MINOR_INJURY: "Minor injury", NEAR_MISS: "Near miss" };

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.teamId) return new NextResponse("Unauthorized", { status: 401 });
  if (!canSeeAudit(session.user.roles)) return new NextResponse("Only Team Leadership, Head Mentors and the Safety Captain can export the audit log.", { status: 403 });
  const teamId = session.user.teamId;

  const team = await prisma.team.findUnique({ where: { id: teamId }, select: { teamNumber: true, timezone: true } });
  const q = new URL(req.url).searchParams;
  const range = auditRange({ from: q.get("from"), to: q.get("to"), show: q.get("show") }, team?.timezone);
  const { events, incidents, changeRows } = await loadAudit(teamId, range, CHANGE_LIMIT);

  // Times in the team's time zone, sortable: 2026-10-30 08:44
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: range.tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const when = (d: Date) => {
    const p = Object.fromEntries(parts.formatToParts(d).map((x) => [x.type, x.value]));
    return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
  };

  type Row = { at: Date; cells: unknown[] };
  const rows: Row[] = [];

  for (const { at, kind, c } of events) {
    const tool = `${c.tool.name}${c.tool.assetTag ? ` ${c.tool.assetTag}` : ""}`;
    const details = kind === "out"
      ? [c.intendedUse, `due ${calendarDayKey(c.expectedReturn)}`].filter(Boolean).join(" · ")
      : [c.returnCondition ? `returned ${c.returnCondition.replace(/_/g, " ").toLowerCase()}` : null, c.notes].filter(Boolean).join(" · ");
    rows.push({ at, cells: [when(at), kind === "out" ? "Tool checked out" : "Tool checked in", tool, c.user.name, "", "", "", details] });
  }

  for (const i of incidents) {
    const details = [
      i.description,
      i.toolOrMaterial && `Tool or material: ${i.toolOrMaterial}`,
      i.peopleInvolved && `People involved: ${i.peopleInvolved}`,
      i.immediateAction && `Immediate action: ${i.immediateAction}`,
      i.correctiveAction && `Corrective action: ${i.correctiveAction}`,
    ].filter(Boolean).join(" | ");
    rows.push({ at: i.createdAt, cells: [`${calendarDayKey(i.incidentDate)} (reported ${when(i.createdAt)})`, "Safety report", SEVERITY[i.severity] ?? i.severity, i.reportedBy.name, "", "", "", details] });
  }

  for (const e of toHistoryEntries(changeRows)) {
    const at = new Date(e.at);
    const kind = `${ENTITY_LABELS[e.entityType]} ${e.action === "updated" ? "changed" : e.action}`;
    const item = e.entityId ? e.entityLabel : `${e.entityLabel} (schedule)`;
    const who = e.who ?? "System";
    if (e.changes.length === 0) rows.push({ at, cells: [when(at), kind, item, who, "", "", "", ""] });
    for (const c of e.changes) rows.push({ at, cells: [when(at), kind, item, who, c.field, c.from, c.to, ""] });
  }

  rows.sort((a, b) => a.at.getTime() - b.at.getTime());
  const header = ["When", "What", "Item", "Who", "Field", "From", "To", "Details"];
  const csv = [header, ...rows.map((r) => r.cells)].map((cells) => cells.map(csvCell).join(",")).join("\r\n") + "\r\n";

  const name = `audit-log-team-${team?.teamNumber ?? ""}-${range.from}-to-${range.to}${range.show === "all" ? "" : `-${range.show}`}.csv`;
  return new NextResponse("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
