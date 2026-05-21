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
}

const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS     = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const MONTHS_S   = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function fmt12(time24: string) {
  const [h, m] = time24.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

function ymd(d: Date) { return d.toISOString().slice(0, 10); }

function getWeekSunday(offset: number): Date {
  const now = new Date();
  const d   = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay() + offset * 7);
  return d;
}

export function PublicCalendarClient({ meetings }: Props) {
  const [view,       setView]       = useState<"week" | "list">("week");
  const [weekOffset, setWeekOffset] = useState(0);
  const [selected,   setSelected]   = useState<Meeting | null>(null);

  const today    = new Date();
  const todayStr = ymd(today);

  // Index meetings by date string
  const meetingMap: Record<string, Meeting[]> = {};
  for (const m of meetings) {
    const key = m.date.slice(0, 10);
    if (!meetingMap[key]) meetingMap[key] = [];
    meetingMap[key].push(m);
  }

  // Week data
  const weekSunday = getWeekSunday(weekOffset);
  const weekDays   = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekSunday);
    d.setDate(weekSunday.getDate() + i);
    return d;
  });

  const weekSat = weekDays[6];
  const weekLabel = weekSunday.getMonth() === weekSat.getMonth()
    ? `${MONTHS[weekSunday.getMonth()]} ${weekSunday.getDate()}–${weekSat.getDate()}, ${weekSunday.getFullYear()}`
    : `${MONTHS_S[weekSunday.getMonth()]} ${weekSunday.getDate()} – ${MONTHS_S[weekSat.getMonth()]} ${weekSat.getDate()}, ${weekSat.getFullYear()}`;

  // List view — group by month
  const byMonth: { label: string; meetings: Meeting[] }[] = [];
  for (const m of meetings) {
    const d     = new Date(m.date);
    const label = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    const bucket = byMonth.find((b) => b.label === label);
    if (bucket) bucket.meetings.push(m);
    else byMonth.push({ label, meetings: [m] });
  }

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex items-center gap-0 border-b border-[--color-border]">
        {(["week", "list"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              view === v
                ? "text-[--color-primary] border-[--color-primary]"
                : "text-[--color-text-secondary] border-transparent hover:text-[--color-text-primary]"
            }`}
          >
            {v === "week" ? "Week" : "List"}
          </button>
        ))}
      </div>

      {view === "week" ? (
        /* ── Week view ── */
        <div className="space-y-3">
          {/* Week navigator */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setWeekOffset((o) => o - 1)}
              className="h-8 w-8 rounded flex items-center justify-center text-[--color-text-secondary] hover:bg-[--color-surface-overlay] transition-colors text-lg"
              aria-label="Previous week"
            >‹</button>
            <div className="text-center">
              <p className="text-sm font-semibold text-[--color-text-primary]">{weekLabel}</p>
              {weekOffset !== 0 && (
                <button
                  onClick={() => setWeekOffset(0)}
                  className="text-xs text-[--color-secondary] hover:underline"
                >
                  This week
                </button>
              )}
            </div>
            <button
              onClick={() => setWeekOffset((o) => o + 1)}
              className="h-8 w-8 rounded flex items-center justify-center text-[--color-text-secondary] hover:bg-[--color-surface-overlay] transition-colors text-lg"
              aria-label="Next week"
            >›</button>
          </div>

          {/* Calendar card */}
          <div
            className="rounded-xl border border-[--color-border]/60 overflow-hidden"
            style={{ boxShadow: "var(--shadow-card)" }}
          >
            {/* Gradient DOW header */}
            <div
              className="grid grid-cols-7"
              style={{
                background: "linear-gradient(135deg, color-mix(in srgb, var(--color-primary) 20%, var(--color-surface-raised)) 0%, color-mix(in srgb, var(--color-secondary) 14%, var(--color-surface-raised)) 100%)",
              }}
            >
              {DOW_LABELS.map((d) => (
                <div key={d} className="py-2.5 text-center text-label font-semibold text-[--color-text-primary] tracking-wide">
                  {d}
                </div>
              ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7 bg-[--color-surface]">
              {weekDays.map((date) => {
                const key         = ymd(date);
                const isToday     = key === todayStr;
                const isWeekend   = date.getDay() === 0 || date.getDay() === 6;
                const dayMeetings = meetingMap[key] ?? [];

                return (
                  <div
                    key={key}
                    className={[
                      "relative min-h-[120px] p-1.5 border-b border-r border-[--color-border]/20",
                      !isToday && isWeekend ? "bg-[--color-surface-raised]/40" : "",
                    ].join(" ")}
                    style={isToday ? { backgroundColor: "color-mix(in srgb, var(--color-primary) 10%, transparent)" } : undefined}
                  >
                    {/* Date number */}
                    <div className="mb-1">
                      <span
                        className="text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full"
                        style={isToday
                          ? { backgroundColor: "var(--color-primary)", color: "#fff" }
                          : { color: "var(--color-text-primary)" }}
                      >
                        {date.getDate()}
                      </span>
                    </div>

                    {/* Meeting chips */}
                    <div className="space-y-0.5">
                      {dayMeetings.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => setSelected(selected?.id === m.id ? null : m)}
                          className="w-full text-left text-[10px] font-medium px-1.5 py-0.5 rounded-sm truncate leading-relaxed text-white hover:opacity-85 transition-opacity"
                          style={{ backgroundColor: "var(--color-secondary)" }}
                        >
                          {fmt12(m.startTime)} {m.title ?? "Build meeting"}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Meeting detail panel */}
          {selected && (
            <div
              className="rounded-xl border border-[--color-border] p-4 space-y-2"
              style={{ boxShadow: "var(--shadow-card)" }}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-[--color-text-primary]">
                    {new Date(selected.date + "T12:00:00").toLocaleDateString("en-US", {
                      weekday: "long", month: "long", day: "numeric",
                    })}
                  </p>
                  <p className="text-small text-[--color-text-secondary]">
                    {fmt12(selected.startTime)} – {fmt12(selected.endTime)}
                    {selected.title && <span className="ml-2 font-medium text-[--color-text-primary]">{selected.title}</span>}
                  </p>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  className="text-[--color-text-secondary] hover:text-[--color-text-primary] text-lg leading-none"
                >×</button>
              </div>
              {selected.tasks.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {selected.tasks.map((t, i) => (
                    <span key={i} className="badge badge-neutral text-xs">{t.name}</span>
                  ))}
                </div>
              )}
              {selected.notes && (
                <p className="text-small text-[--color-text-secondary] whitespace-pre-wrap">{selected.notes}</p>
              )}
            </div>
          )}
        </div>
      ) : (
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
                      className={`rounded-lg border px-4 py-3 ${isToday ? "border-[--color-primary] bg-[--color-primary]/5" : "border-[--color-border]"}`}
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
      )}
    </div>
  );
}
