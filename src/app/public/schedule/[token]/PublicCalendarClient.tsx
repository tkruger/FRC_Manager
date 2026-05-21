"use client";

import { useState } from "react";

interface Meeting {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  title: string | null;
  notes: string | null;
  tasks: { name: string; subTeam: string | null }[];
}

interface Props {
  meetings: Meeting[];
  kickoffDate: string;
  week0Date:   string;
}

const DOW_FULL  = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const DOW_SHORT = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const MONTHS    = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function fmt12(time24: string) {
  const [h, m] = time24.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

function ymd(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getWeekSunday(offset: number): Date {
  const now = new Date();
  const d   = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  d.setDate(d.getDate() - d.getDay() + offset * 7);
  return d;
}

export function PublicCalendarClient({ meetings }: Props) {
  const [view,       setView]       = useState<"list" | "week">("list");
  const [weekOffset, setWeekOffset] = useState(0);

  const todayStr = ymd(new Date());

  const meetingsByDate = new Map<string, Meeting[]>();
  for (const m of meetings) {
    const key = m.date.slice(0, 10);
    if (!meetingsByDate.has(key)) meetingsByDate.set(key, []);
    meetingsByDate.get(key)!.push(m);
  }

  // Group meetings by month for list view
  const byMonth: { label: string; meetings: Meeting[] }[] = [];
  for (const m of meetings) {
    const d     = new Date(m.date);
    const label = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    const existing = byMonth.find((b) => b.label === label);
    if (existing) existing.meetings.push(m);
    else byMonth.push({ label, meetings: [m] });
  }

  // Week view data
  const weekSunday = getWeekSunday(weekOffset);
  const weekDays   = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekSunday);
    d.setDate(weekSunday.getDate() + i);
    return d;
  });
  const weekLabel = (() => {
    const s = weekDays[0], e = weekDays[6];
    if (s.getMonth() === e.getMonth())
      return `${MONTHS[s.getMonth()]} ${s.getDate()}–${e.getDate()}, ${s.getFullYear()}`;
    return `${MONTHS[s.getMonth()]} ${s.getDate()} – ${MONTHS[e.getMonth()]} ${e.getDate()}, ${e.getFullYear()}`;
  })();

  return (
    <div className="space-y-4">
      {/* Tab toggle */}
      <div className="flex items-center gap-0 border-b border-[--color-border]">
        {(["list", "week"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              view === v
                ? "text-[--color-primary] border-[--color-primary]"
                : "text-[--color-text-secondary] border-transparent hover:text-[--color-text-primary]"
            }`}
          >
            {v === "list" ? "List" : "Week"}
          </button>
        ))}
      </div>

      {view === "list" ? (
        /* ── List view ── */
        <div className="space-y-8">
          {byMonth.length === 0 && (
            <p className="text-center py-16 text-[--color-text-secondary]">
              No meetings scheduled yet. Check back soon.
            </p>
          )}
          {byMonth.map(({ label, meetings: ms }) => (
            <section key={label}>
              <h2 className="text-h3 text-[--color-text-primary] mb-4">{label}</h2>
              <div className="space-y-3">
                {ms.map((m) => {
                  const isToday = m.date.slice(0, 10) === todayStr;
                  const d = new Date(m.date);
                  return (
                    <div
                      key={m.id}
                      className={`rounded-lg border px-4 py-3 ${
                        isToday ? "border-[--color-primary] bg-[--color-primary]/5" : "border-[--color-border]"
                      }`}
                    >
                      <p className="text-sm font-semibold text-[--color-text-primary]">
                        {d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
                        {isToday && <span className="ml-2 badge badge-info text-xs">Today</span>}
                      </p>
                      {m.title && <p className="text-body text-[--color-text-primary] mt-0.5">{m.title}</p>}
                      <p className="text-small text-[--color-text-secondary] mt-0.5">
                        {fmt12(m.startTime)} – {fmt12(m.endTime)}
                      </p>
                      {m.tasks.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {m.tasks.map((t, i) => (
                            <span key={i} className="badge badge-neutral text-xs">{t.name}</span>
                          ))}
                        </div>
                      )}
                      {m.notes && (
                        <p className="text-small text-[--color-text-secondary] mt-2 whitespace-pre-wrap">{m.notes}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      ) : (
        /* ── Week view ── */
        <div className="space-y-3">
          {/* Week navigator */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setWeekOffset((o) => o - 1)}
              className="p-2 rounded-md text-[--color-text-secondary] hover:bg-[--color-surface-overlay] transition-colors"
              aria-label="Previous week"
            >
              ‹
            </button>
            <div className="text-center">
              <p className="text-sm font-semibold text-[--color-text-primary]">{weekLabel}</p>
              {weekOffset !== 0 && (
                <button
                  onClick={() => setWeekOffset(0)}
                  className="text-xs text-[--color-secondary] hover:underline"
                >
                  Back to this week
                </button>
              )}
            </div>
            <button
              onClick={() => setWeekOffset((o) => o + 1)}
              className="p-2 rounded-md text-[--color-text-secondary] hover:bg-[--color-surface-overlay] transition-colors"
              aria-label="Next week"
            >
              ›
            </button>
          </div>

          {/* 7-column grid */}
          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {/* Day headers */}
            {weekDays.map((d, i) => (
              <div
                key={i}
                className={`text-center py-1 rounded-md text-xs font-semibold ${
                  ymd(d) === todayStr
                    ? "text-[--color-primary]"
                    : "text-[--color-text-secondary]"
                }`}
              >
                <span className="hidden sm:inline">{DOW_FULL[d.getDay()]}</span>
                <span className="sm:hidden">{DOW_SHORT[d.getDay()]}</span>
              </div>
            ))}

            {/* Day cells */}
            {weekDays.map((d) => {
              const dateStr      = ymd(d);
              const isToday      = dateStr === todayStr;
              const dayMeetings  = meetingsByDate.get(dateStr) ?? [];

              return (
                <div
                  key={dateStr}
                  className={`min-h-24 rounded-lg border p-1.5 sm:p-2 flex flex-col gap-1 ${
                    isToday
                      ? "border-[--color-primary] bg-[--color-primary]/5"
                      : "border-[--color-border] bg-[--color-surface-overlay]/40"
                  }`}
                >
                  {/* Date number */}
                  <p className={`text-xs font-bold mb-0.5 ${
                    isToday ? "text-[--color-primary]" : "text-[--color-text-secondary]"
                  }`}>
                    {d.getDate()}
                  </p>

                  {/* Meetings */}
                  {dayMeetings.map((m) => (
                    <div
                      key={m.id}
                      className="rounded p-1 text-xs bg-[--color-primary]/10 border border-[--color-primary]/20 space-y-0.5"
                    >
                      <p className="font-semibold text-[--color-primary] leading-tight">
                        {fmt12(m.startTime)}
                      </p>
                      {m.title && (
                        <p className="text-[--color-text-primary] leading-tight truncate">{m.title}</p>
                      )}
                      {m.tasks.length > 0 && (
                        <p className="text-[--color-text-secondary] leading-tight truncate">
                          {m.tasks.map((t) => t.name).join(", ")}
                        </p>
                      )}
                    </div>
                  ))}

                  {dayMeetings.length === 0 && (
                    <span className="text-[10px] text-[--color-text-disabled] mt-auto">—</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Meeting details below grid for the week */}
          {weekDays.some((d) => (meetingsByDate.get(ymd(d)) ?? []).length > 0) && (
            <div className="space-y-2 pt-2 border-t border-[--color-border]">
              <p className="text-label text-[--color-text-secondary]">This week's meetings</p>
              {weekDays.map((d) => {
                const dateStr     = ymd(d);
                const dayMeetings = meetingsByDate.get(dateStr) ?? [];
                if (dayMeetings.length === 0) return null;
                const isToday = dateStr === todayStr;
                return (
                  <div key={dateStr} className={`rounded-lg border px-3 py-2.5 ${
                    isToday ? "border-[--color-primary] bg-[--color-primary]/5" : "border-[--color-border]"
                  }`}>
                    <p className="text-sm font-semibold text-[--color-text-primary] mb-1">
                      {d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
                      {isToday && <span className="ml-2 badge badge-info text-xs">Today</span>}
                    </p>
                    {dayMeetings.map((m) => (
                      <div key={m.id} className="text-sm space-y-0.5">
                        <p className="text-[--color-text-secondary]">
                          {fmt12(m.startTime)} – {fmt12(m.endTime)}
                          {m.title && <span className="ml-2 text-[--color-text-primary] font-medium">{m.title}</span>}
                        </p>
                        {m.tasks.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {m.tasks.map((t, i) => (
                              <span key={i} className="badge badge-neutral text-xs">{t.name}</span>
                            ))}
                          </div>
                        )}
                        {m.notes && (
                          <p className="text-small text-[--color-text-secondary] whitespace-pre-wrap">{m.notes}</p>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
