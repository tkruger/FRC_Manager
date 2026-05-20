// RFC 5545 iCalendar feed — subscribe in Google Calendar, Apple Calendar, Outlook, etc.
// URL format: /api/calendar/{calendarToken}.ics
// The .ics extension is stripped by the [token] param matching

import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

function icsDate(date: Date, timeStr: string): string {
  // Returns YYYYMMDDTHHMMSS local time (no Z suffix = floating time)
  const d = new Date(date);
  const [h, m] = timeStr.split(":").map(Number);
  d.setHours(h, m, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `T${pad(d.getHours())}${pad(d.getMinutes())}00`
  );
}

function icsDateOnly(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
}

function escapeIcs(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function foldLine(line: string): string {
  // RFC 5545 requires lines ≤ 75 octets; fold longer lines
  const chunks: string[] = [];
  while (line.length > 75) {
    chunks.push(line.slice(0, 75));
    line = " " + line.slice(75);
  }
  chunks.push(line);
  return chunks.join("\r\n");
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token: rawToken } = await params;
  // Strip .ics extension if present
  const token = rawToken.replace(/\.ics$/, "");

  const season = await prisma.season.findUnique({
    where: { calendarToken: token },
    include: {
      team: { select: { teamNumber: true, name: true } },
      meetings: {
        where: { cancelled: false },
        orderBy: { date: "asc" },
        include: { tasks: { select: { name: true } } },
      },
      competitionEvents: { orderBy: { startDate: "asc" } },
    },
  });

  if (!season) return new NextResponse("Not found", { status: 404 });

  const now   = new Date().toISOString().replace(/[-:.]/g, "").slice(0, 15) + "Z";
  const calId = `frcmanager-${season.id}@frc-manager.app`;

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//FRC Manager//Team ${season.team.teamNumber}//EN`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcs(`Team ${season.team.teamNumber} — ${season.name}`)}`,
    `X-WR-CALDESC:${escapeIcs(`Build season schedule for ${season.team.name}`)}`,
    "X-WR-TIMEZONE:America/New_York",
  ];

  // Kickoff event
  lines.push(
    "BEGIN:VEVENT",
    `UID:kickoff-${season.id}@frc-manager.app`,
    `DTSTAMP:${now}`,
    `DTSTART;VALUE=DATE:${icsDateOnly(season.kickoffDate)}`,
    `DTEND;VALUE=DATE:${icsDateOnly(new Date(season.kickoffDate.getTime() + 86400000))}`,
    foldLine(`SUMMARY:🚀 ${escapeIcs(season.name)} — KICKOFF`),
    "BEGIN:VALARM",
    "TRIGGER:-PT1H",
    "ACTION:DISPLAY",
    "DESCRIPTION:Kickoff today!",
    "END:VALARM",
    "END:VEVENT"
  );

  // Week 0 event
  lines.push(
    "BEGIN:VEVENT",
    `UID:week0-${season.id}@frc-manager.app`,
    `DTSTAMP:${now}`,
    `DTSTART;VALUE=DATE:${icsDateOnly(season.week0Date)}`,
    `DTEND;VALUE=DATE:${icsDateOnly(new Date(season.week0Date.getTime() + 86400000))}`,
    foldLine(`SUMMARY:🤖 ${escapeIcs(season.name)} — WEEK 0 (Robot Done)`),
    "BEGIN:VALARM",
    "TRIGGER:-P3D",
    "ACTION:DISPLAY",
    "DESCRIPTION:Week 0 is in 3 days — robot must be done!",
    "END:VALARM",
    "END:VEVENT"
  );

  // Build meetings
  for (const m of season.meetings) {
    const taskList = m.tasks.length > 0
      ? `\\n\\nLinked tasks:\\n${m.tasks.map((t) => `• ${t.name}`).join("\\n")}`
      : "";

    lines.push(
      "BEGIN:VEVENT",
      `UID:meeting-${m.id}@frc-manager.app`,
      `DTSTAMP:${now}`,
      `DTSTART:${icsDate(m.date, m.startTime)}`,
      `DTEND:${icsDate(m.date, m.endTime)}`,
      foldLine(`SUMMARY:${escapeIcs(m.title ?? `Build Meeting — Team ${season.team.teamNumber}`)}`),
      ...(m.notes || taskList ? [foldLine(`DESCRIPTION:${escapeIcs((m.notes ?? "") + taskList)}`)] : []),
      "BEGIN:VALARM",
      "TRIGGER:-PT30M",
      "ACTION:DISPLAY",
      "DESCRIPTION:Build meeting in 30 minutes",
      "END:VALARM",
      "END:VEVENT"
    );
  }

  // Competition events
  for (const ev of season.competitionEvents) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:comp-${ev.id}@frc-manager.app`,
      `DTSTAMP:${now}`,
      `DTSTART;VALUE=DATE:${icsDateOnly(ev.startDate)}`,
      `DTEND;VALUE=DATE:${icsDateOnly(new Date(ev.endDate.getTime() + 86400000))}`,
      foldLine(`SUMMARY:🏆 ${escapeIcs(ev.name)}${ev.location ? ` — ${escapeIcs(ev.location)}` : ""}`),
      "END:VEVENT"
    );
  }

  lines.push("END:VCALENDAR");

  const ics = lines.join("\r\n");

  return new NextResponse(ics, {
    headers: {
      "Content-Type":        "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="team-${season.team.teamNumber}-schedule.ics"`,
      "Cache-Control":       "no-cache, no-store",
    },
  });
}
