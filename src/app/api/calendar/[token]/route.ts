// RFC 5545 iCalendar feed — subscribe in Google Calendar, Apple Calendar, Outlook, etc.
// URL: /api/calendar/{calendarToken}.ics  (.ics stripped from [token] param)

import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pad(n: number) { return String(n).padStart(2, "0"); }

/** YYYYMMDDTHHMMSS — floating local time (no Z) */
function icsDateTime(date: Date, timeStr: string): string {
  const d = new Date(date);
  const [h, m] = timeStr.split(":").map(Number);
  d.setHours(h, m, 0, 0);
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `T${pad(d.getHours())}${pad(d.getMinutes())}00`
  );
}

/** YYYYMMDD — date-only value */
function icsDate(date: Date): string {
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
}

/** Escape text for iCal property values */
function esc(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

/** RFC 5545 line folding — 75 octets max per line, fold with CRLF + SPACE.
 *  We use a simple byte-safe approach: encode, split at 75-byte boundaries. */
function fold(line: string): string {
  const encoder = new TextEncoder();
  const bytes   = encoder.encode(line);
  if (bytes.length <= 75) return line;

  const decoder = new TextDecoder("utf-8");
  const parts: string[] = [];
  let pos = 0;
  while (pos < bytes.length) {
    const limit = pos === 0 ? 75 : 74; // continuation lines start with a space (1 byte)
    // Find safe UTF-8 boundary within limit
    let end = Math.min(pos + limit, bytes.length);
    // Back up if we're mid-codepoint
    while (end < bytes.length && (bytes[end] & 0xc0) === 0x80) end--;
    parts.push(decoder.decode(bytes.slice(pos, end)));
    pos = end;
  }
  return parts.join("\r\n ");
}

/** Build one iCal property line, folded to 75 octets */
function prop(name: string, value: string, params = ""): string {
  const key = params ? `${name};${params}` : name;
  return fold(`${key}:${value}`);
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token: rawToken } = await params;
  const token = rawToken.replace(/\.ics$/, "");

  const season = await prisma.season.findUnique({
    where: { calendarToken: token },
    include: {
      team:              { select: { teamNumber: true, name: true } },
      meetings: {
        where:   { cancelled: false },
        orderBy: { date: "asc" },
        include: { tasks: { select: { name: true } } },
      },
      competitionEvents: { orderBy: { startDate: "asc" } },
    },
  });

  if (!season) {
    return new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain" } });
  }

  const now = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "") + "Z";
  // Remove sub-second precision and dots, ensure Z suffix:  20260101T120000Z

  const lines: string[] = [];
  const L = (...items: string[]) => lines.push(...items);

  L(
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    prop("PRODID", `-//FRC Manager//Team ${season.team.teamNumber}//EN`),
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    prop("X-WR-CALNAME",  esc(`Team ${season.team.teamNumber} - ${season.name}`)),
    prop("X-WR-CALDESC",  esc(`Build season schedule for ${season.team.name}`)),
    "X-WR-TIMEZONE:America/New_York",
  );

  // Kickoff
  const kickoffEnd = new Date(season.kickoffDate.getTime() + 86400000);
  L(
    "BEGIN:VEVENT",
    prop("UID",     `kickoff-${season.id}@frc-manager.app`),
    prop("DTSTAMP", now),
    prop("DTSTART", icsDate(season.kickoffDate), "VALUE=DATE"),
    prop("DTEND",   icsDate(kickoffEnd),          "VALUE=DATE"),
    prop("SUMMARY", esc(`${season.name} - KICKOFF`)),
    "BEGIN:VALARM",
    "TRIGGER:-PT1H",
    "ACTION:DISPLAY",
    prop("DESCRIPTION", "Kickoff today!"),
    "END:VALARM",
    "END:VEVENT",
  );

  // Week 0
  const week0End = new Date(season.week0Date.getTime() + 86400000);
  L(
    "BEGIN:VEVENT",
    prop("UID",     `week0-${season.id}@frc-manager.app`),
    prop("DTSTAMP", now),
    prop("DTSTART", icsDate(season.week0Date), "VALUE=DATE"),
    prop("DTEND",   icsDate(week0End),          "VALUE=DATE"),
    prop("SUMMARY", esc(`${season.name} - WEEK 0 (Robot Done)`)),
    "BEGIN:VALARM",
    "TRIGGER:-P3D",
    "ACTION:DISPLAY",
    prop("DESCRIPTION", "Week 0 is in 3 days - robot must be done!"),
    "END:VALARM",
    "END:VEVENT",
  );

  // Build meetings
  for (const m of season.meetings) {
    const desc = [
      m.notes ?? "",
      m.tasks.length > 0 ? `Linked tasks:\n${m.tasks.map(t => `- ${t.name}`).join("\n")}` : "",
    ].filter(Boolean).join("\n\n");

    L(
      "BEGIN:VEVENT",
      prop("UID",     `meeting-${m.id}@frc-manager.app`),
      prop("DTSTAMP", now),
      prop("DTSTART", icsDateTime(m.date, m.startTime)),
      prop("DTEND",   icsDateTime(m.date, m.endTime)),
      prop("SUMMARY", esc(m.title ?? `Build Meeting - Team ${season.team.teamNumber}`)),
      ...(desc ? [prop("DESCRIPTION", esc(desc))] : []),
      "BEGIN:VALARM",
      "TRIGGER:-PT30M",
      "ACTION:DISPLAY",
      prop("DESCRIPTION", "Build meeting in 30 minutes"),
      "END:VALARM",
      "END:VEVENT",
    );
  }

  // Competition events
  for (const ev of season.competitionEvents) {
    const evEnd = new Date(ev.endDate.getTime() + 86400000);
    L(
      "BEGIN:VEVENT",
      prop("UID",     `comp-${ev.id}@frc-manager.app`),
      prop("DTSTAMP", now),
      prop("DTSTART", icsDate(ev.startDate), "VALUE=DATE"),
      prop("DTEND",   icsDate(evEnd),         "VALUE=DATE"),
      prop("SUMMARY", esc(`${ev.name}${ev.location ? ` - ${ev.location}` : ""}`)),
      "END:VEVENT",
    );
  }

  L("END:VCALENDAR");

  // RFC 5545: every line ends with CRLF, including the last
  const ics = lines.join("\r\n") + "\r\n";

  return new Response(ics, {
    status: 200,
    headers: {
      "Content-Type":  "text/calendar; charset=utf-8",
      // inline (not attachment) so clients parse it rather than download
      "Content-Disposition": `inline; filename="team-${season.team.teamNumber}-schedule.ics"`,
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}
