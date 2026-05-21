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

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const DOW = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function fmt12(time24: string) {
  const [h, m] = time24.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

function ymd(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function PublicCalendarClient({ meetings, kickoffDate, week0Date }: Props) {
  const [view, setView] = useState<"list" | "month">("list");
  const [monthIdx, setMonthIdx] = useState(0);

  const todayStr = ymd(new Date());
  const meetingsByDate = new Map<string, Meeting[]>();
  for (const m of meetings) {
    const key = m.date.slice(0, 10);
    if (!meetingsByDate.has(key)) meetingsByDate.set(key, []);
    meetingsByDate.get(key)!.push(m);
  }

  // Build list of months to show
  const kickoff = new Date(kickoffDate);
  const week0   = new Date(week0Date);
  const months: { year: number; month: number }[] = [];
  const cur = new Date(kickoff.getFullYear(), kickoff.getMonth(), 1);
  const end = new Date(week0.getFullYear(), week0.getMonth(), 1);
  while (cur <= end) {
    months.push({ year: cur.getFullYear(), month: cur.getMonth() });
    cur.setMonth(cur.getMonth() + 1);
  }

  // Group meetings by month label for list view
  const byMonth: { label: string; meetings: Meeting[] }[] = [];
  for (const m of meetings) {
    const d = new Date(m.date);
    const label = d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    const existing = byMonth.find((b) => b.label === label);
    if (existing) existing.meetings.push(m);
    else byMonth.push({ label, meetings: [m] });
  }

  const currentMonth = months[monthIdx] ?? months[0];

  return (
    <div className="space-y-4">
      {/* View toggle */}
      <div className="flex items-center gap-2 border-b border-[--color-border] pb-0">
        {(["list", "month"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors capitalize ${
              view === v
                ? "text-[--color-primary] border-[--color-primary]"
                : "text-[--color-text-secondary] border-transparent hover:text-[--color-text-primary]"
            }`}
          >
            {v === "list" ? "List" : "Month"}
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
                        isToday
                          ? "border-[--color-primary] bg-[--color-primary]/5"
                          : "border-[--color-border]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold text-[--color-text-primary]">
                            {d.toLocaleDateString("en-US", {
                              weekday: "long", month: "short", day: "numeric",
                            })}
                            {isToday && (
                              <span className="ml-2 badge badge-info text-xs">Today</span>
                            )}
                          </p>
                          {m.title && (
                            <p className="text-body text-[--color-text-primary] mt-0.5">{m.title}</p>
                          )}
                          <p className="text-small text-[--color-text-secondary] mt-0.5">
                            {fmt12(m.startTime)} – {fmt12(m.endTime)}
                          </p>
                        </div>
                      </div>
                      {m.tasks.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {m.tasks.map((t, i) => (
                            <span key={i} className="badge badge-neutral text-xs">{t.name}</span>
                          ))}
                        </div>
                      )}
                      {m.notes && (
                        <p className="text-small text-[--color-text-secondary] mt-2 whitespace-pre-wrap">
                          {m.notes}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      ) : (
        /* ── Month grid view ── */
        <div className="space-y-4">
          {/* Month navigator */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setMonthIdx((i) => Math.max(0, i - 1))}
              disabled={monthIdx === 0}
              className="p-2 rounded-md text-[--color-text-secondary] hover:bg-[--color-surface-overlay] disabled:opacity-30 transition-colors"
              aria-label="Previous month"
            >
              ‹
            </button>
            <h2 className="text-h3 text-[--color-text-primary]">
              {currentMonth
                ? `${MONTH_NAMES[currentMonth.month]} ${currentMonth.year}`
                : ""}
            </h2>
            <button
              onClick={() => setMonthIdx((i) => Math.min(months.length - 1, i + 1))}
              disabled={monthIdx === months.length - 1}
              className="p-2 rounded-md text-[--color-text-secondary] hover:bg-[--color-surface-overlay] disabled:opacity-30 transition-colors"
              aria-label="Next month"
            >
              ›
            </button>
          </div>

          {currentMonth && (
            <MonthGrid
              year={currentMonth.year}
              month={currentMonth.month}
              meetingsByDate={meetingsByDate}
              todayStr={todayStr}
            />
          )}
        </div>
      )}
    </div>
  );
}

function MonthGrid({
  year, month, meetingsByDate, todayStr,
}: {
  year: number;
  month: number;
  meetingsByDate: Map<string, Meeting[]>;
  todayStr: string;
}) {
  const [selected, setSelected] = useState<string | null>(null);

  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const selectedMeetings = selected ? meetingsByDate.get(selected) ?? [] : [];

  return (
    <div className="space-y-3">
      {/* Day of week headers */}
      <div className="grid grid-cols-7 gap-px">
        {DOW.map((d) => (
          <div key={d} className="text-center text-xs font-semibold text-[--color-text-secondary] py-2">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (!day) return <div key={`e-${i}`} />;
          const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const hasMeetings = meetingsByDate.has(dateStr);
          const isToday = dateStr === todayStr;
          const isSelected = selected === dateStr;

          return (
            <button
              key={dateStr}
              onClick={() => setSelected(isSelected ? null : dateStr)}
              className={`relative aspect-square rounded-lg flex flex-col items-center justify-start pt-1.5 text-sm font-medium transition-all ${
                isToday
                  ? "ring-2 ring-[--color-primary] ring-offset-1"
                  : ""
              } ${
                isSelected
                  ? "bg-[--color-primary] text-white"
                  : hasMeetings
                  ? "bg-[--color-primary]/10 text-[--color-primary] hover:bg-[--color-primary]/20"
                  : "text-[--color-text-secondary] hover:bg-[--color-surface-overlay]"
              }`}
            >
              {day}
              {hasMeetings && !isSelected && (
                <span className="absolute bottom-1.5 w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: "var(--color-primary)" }} />
              )}
            </button>
          );
        })}
      </div>

      {/* Selected day meetings */}
      {selected && (
        <div className="rounded-lg border border-[--color-border] p-4 space-y-3">
          <p className="text-sm font-semibold text-[--color-text-primary]">
            {new Date(selected + "T12:00:00").toLocaleDateString("en-US", {
              weekday: "long", month: "long", day: "numeric",
            })}
          </p>
          {selectedMeetings.length === 0 ? (
            <p className="text-small text-[--color-text-secondary]">No meetings on this day.</p>
          ) : (
            selectedMeetings.map((m) => (
              <div key={m.id} className="space-y-1">
                {m.title && (
                  <p className="text-sm font-medium text-[--color-text-primary]">{m.title}</p>
                )}
                <p className="text-small text-[--color-text-secondary]">
                  {fmt12(m.startTime)} – {fmt12(m.endTime)}
                </p>
                {m.tasks.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {m.tasks.map((t, i) => (
                      <span key={i} className="badge badge-neutral text-xs">{t.name}</span>
                    ))}
                  </div>
                )}
                {m.notes && (
                  <p className="text-small text-[--color-text-secondary] whitespace-pre-wrap">{m.notes}</p>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
