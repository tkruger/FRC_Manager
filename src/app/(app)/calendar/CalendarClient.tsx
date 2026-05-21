"use client";

import { useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  updateMeetingAction, cancelMeetingAction, restoreMeetingAction,
  addMeetingAction, generateMeetingsAction,
} from "@/app/actions/meetings";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogClose } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { SUBTEAM_COLORS } from "@/lib/schedule-helpers";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MeetingTask { id: string; name: string; status: string; subTeam: string | null; }
interface Meeting {
  id: string; date: string; startTime: string; endTime: string;
  title: string | null; notes: string | null; cancelled: boolean; cancelReason: string | null;
  tasks: MeetingTask[];
}
interface TaskOption { id: string; name: string; status: string; subTeam: string | null; dueDate: string | null; }
interface Season {
  id: string; name: string; kickoffDate: string; week0Date: string;
  meetingDays: string[]; calendarToken: string | null;
}

interface Props {
  season: Season;
  meetings: Meeting[];
  allTasks: TaskOption[];
  isLeadership: boolean;
  nextauthUrl: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt12(time24: string) {
  const [h, m] = time24.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

function ymd(date: Date) {
  return date.toISOString().slice(0, 10);
}

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

const DOW_LABELS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

// ─── Main component ───────────────────────────────────────────────────────────

export function CalendarClient({ season, meetings, allTasks, isLeadership }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const kickoff = new Date(season.kickoffDate);
  const week0   = new Date(season.week0Date);
  const today   = new Date();

  // Start on the month containing today, falling back to kickoff month
  const defaultYear  = today >= kickoff && today <= week0 ? today.getFullYear() : kickoff.getFullYear();
  const defaultMonth = today >= kickoff && today <= week0 ? today.getMonth()     : kickoff.getMonth();

  const [viewYear,    setViewYear]    = useState(defaultYear);
  const [viewMonth,   setViewMonth]   = useState(defaultMonth);
  const [fullSeason,  setFullSeason]  = useState(false);
  const [selected,    setSelected]    = useState<Meeting | null>(null);
  const [showAdd,   setShowAdd]   = useState(false);
  const [addDate,   setAddDate]   = useState("");

  // Build meeting lookup: date string → meetings[]
  const meetingMap: Record<string, Meeting[]> = {};
  for (const m of meetings) {
    const key = m.date.slice(0, 10);
    if (!meetingMap[key]) meetingMap[key] = [];
    meetingMap[key].push(m);
  }

  // Special day lookup
  const kickoffKey = ymd(kickoff);
  const week0Key   = ymd(week0);

  // Month navigation
  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  }
  function goToday() {
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
  }

  // Build a month's cell grid (6 rows × 7 cols)
  function buildCells(year: number, month: number) {
    const firstDay    = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrev  = new Date(year, month, 0).getDate();
    const cells: { date: Date; isCurrentMonth: boolean }[] = [];
    for (let i = firstDay - 1; i >= 0; i--)
      cells.push({ date: new Date(year, month - 1, daysInPrev - i), isCurrentMonth: false });
    for (let d = 1; d <= daysInMonth; d++)
      cells.push({ date: new Date(year, month, d), isCurrentMonth: true });
    const trailing = 42 - cells.length;
    for (let d = 1; d <= trailing; d++)
      cells.push({ date: new Date(year, month + 1, d), isCurrentMonth: false });
    return cells;
  }

  // All season months for full-season view
  const seasonMonths: { year: number; month: number }[] = [];
  {
    const cur = new Date(kickoff.getFullYear(), kickoff.getMonth(), 1);
    const end = new Date(week0.getFullYear(),  week0.getMonth(),   1);
    while (cur <= end) {
      seasonMonths.push({ year: cur.getFullYear(), month: cur.getMonth() });
      cur.setMonth(cur.getMonth() + 1);
    }
  }

  const cells = buildCells(viewYear, viewMonth);

  function handleCancel(meetingId: string, reason?: string) {
    startTransition(async () => {
      await cancelMeetingAction(meetingId, reason);
      setSelected(null);
      router.refresh();
    });
  }
  function handleRestore(meetingId: string) {
    startTransition(async () => {
      await restoreMeetingAction(meetingId);
      setSelected(null);
      router.refresh();
    });
  }
  function handleGenerate() {
    if (!confirm("Replace all auto-generated meetings with fresh ones from the season config? Continue?")) return;
    startTransition(async () => {
      await generateMeetingsAction(season.id);
      router.refresh();
    });
  }

  return (
    <>
      {/* ── Toolbar ── */}
      <div className="px-4 sm:px-6 lg:px-8 flex items-center gap-3 flex-wrap">
        {/* Month navigation */}
        <div className="flex items-center gap-1">
          <button onClick={prevMonth}
            className="h-8 w-8 rounded flex items-center justify-center text-[--color-text-secondary] hover:bg-[--color-surface-overlay] transition-colors">
            ‹
          </button>
          <h2 className="text-h3 text-[--color-text-primary] min-w-[168px] text-center">
            {MONTH_NAMES[viewMonth]} {viewYear}
          </h2>
          <button onClick={nextMonth}
            className="h-8 w-8 rounded flex items-center justify-center text-[--color-text-secondary] hover:bg-[--color-surface-overlay] transition-colors">
            ›
          </button>
        </div>

        <Button variant="outline" size="sm" onClick={goToday} className={fullSeason ? "opacity-50" : ""}>Today</Button>
        <Button
          variant="outline" size="sm"
          onClick={() => setFullSeason(f => !f)}
          style={fullSeason ? { backgroundColor: "var(--color-primary)", color: "#fff", borderColor: "var(--color-primary)" } : undefined}
        >
          {fullSeason ? "Month view" : "Full season"}
        </Button>

        {isLeadership && (
          <>
            <Button variant="outline" size="sm" onClick={handleGenerate} isLoading={isPending}>
              {meetings.length > 0 ? "Regenerate" : "Generate from config"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => { setAddDate(""); setShowAdd(true); }}>
              + Add meeting
            </Button>
          </>
        )}

        <span className="ml-auto text-small text-[--color-text-secondary]">
          {meetings.filter(m => !m.cancelled).length} meetings scheduled
        </span>
      </div>

      {/* ── Calendar grid ── */}
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="rounded-xl border border-[--color-border]/60 overflow-hidden"
          style={{ boxShadow: "var(--shadow-card)" }}>

          {/* Shared DOW header — shown once */}
          <div className="grid grid-cols-7"
            style={{ background: "linear-gradient(135deg, color-mix(in srgb, var(--color-primary) 20%, var(--color-surface-raised)) 0%, color-mix(in srgb, var(--color-secondary) 14%, var(--color-surface-raised)) 100%)" }}>
            {DOW_LABELS.map((d) => (
              <div key={d} className="py-2.5 text-center text-label font-semibold text-[--color-text-primary] tracking-wide">{d}</div>
            ))}
          </div>

          {/* One or all months */}
          {(fullSeason ? seasonMonths : [{ year: viewYear, month: viewMonth }]).map(({ year, month }, mi) => {
            const mCells = buildCells(year, month);
            return (
              <div key={`${year}-${month}`}>
                {/* Month label — only in full-season mode */}
                {fullSeason && (
                  <div className="px-3 py-1 text-small font-semibold text-[--color-text-secondary] border-t border-[--color-border]/30"
                    style={{ backgroundColor: "color-mix(in srgb, var(--color-surface-overlay) 60%, transparent)" }}>
                    {MONTH_NAMES[month]} {year}
                  </div>
                )}

                <div className="grid grid-cols-7 bg-[--color-surface]"
                  style={{ borderTop: fullSeason && mi === 0 ? undefined : "1px solid color-mix(in srgb, var(--color-border) 30%, transparent)" }}>
                  {mCells.map(({ date, isCurrentMonth }, idx) => {
                    const key         = ymd(date);
                    const isToday     = key === ymd(today);
                    const isKickoff   = key === kickoffKey;
                    const isWeek0     = key === week0Key;
                    const isWeekend   = date.getDay() === 0 || date.getDay() === 6;
                    const dayMeetings = meetingMap[key] ?? [];
                    const MAX_CHIPS   = 3;

                    return (
                      <div
                        key={idx}
                        className={[
                          "relative min-h-[110px] p-1.5 border-b border-r border-[--color-border]/20 transition-colors",
                          !isToday && !isCurrentMonth && "bg-[--color-surface-overlay]/30",
                          !isToday && isWeekend && isCurrentMonth && "bg-[--color-surface-raised]/40",
                          isLeadership && "cursor-pointer group",
                        ].filter(Boolean).join(" ")}
                        style={isToday ? { backgroundColor: "color-mix(in srgb, var(--color-primary) 10%, transparent)" } : undefined}
                        onClick={() => {
                          if (isLeadership && dayMeetings.length === 0) { setAddDate(key); setShowAdd(true); }
                        }}
                      >
                        <div className="flex items-center gap-1 mb-1">
                          <span className={[
                            "text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full",
                            isToday ? "text-white" : isCurrentMonth ? "text-[--color-text-primary]" : "text-[--color-text-disabled]",
                          ].join(" ")}
                            style={isToday ? { backgroundColor: "var(--color-primary)" } : undefined}>
                            {date.getDate()}
                          </span>
                          {isKickoff && <span className="text-[9px] font-bold text-[--color-success] leading-none">KICKOFF</span>}
                          {isWeek0   && <span className="text-[9px] font-bold text-[--color-primary] leading-none">WEEK&nbsp;0</span>}
                        </div>

                        <div className="space-y-0.5">
                          {dayMeetings.slice(0, MAX_CHIPS).map((m) => (
                            <button key={m.id}
                              onClick={(e) => { e.stopPropagation(); setSelected(m); }}
                              className={[
                                "w-full text-left text-[10px] font-medium px-1.5 py-0.5 rounded-sm truncate leading-relaxed transition-opacity",
                                m.cancelled ? "line-through opacity-40 bg-[--color-surface-overlay] text-[--color-text-secondary]" : "text-white hover:opacity-85",
                              ].join(" ")}
                              style={!m.cancelled ? { backgroundColor: "var(--color-secondary)" } : undefined}>
                              {fmt12(m.startTime)} {m.title ?? "Build meeting"}
                            </button>
                          ))}
                          {dayMeetings.length > MAX_CHIPS && (
                            <button onClick={(e) => { e.stopPropagation(); setSelected(dayMeetings[MAX_CHIPS]); }}
                              className="text-[10px] text-[--color-secondary] hover:underline px-1.5">
                              +{dayMeetings.length - MAX_CHIPS} more
                            </button>
                          )}
                        </div>

                        {isLeadership && isCurrentMonth && dayMeetings.length === 0 && (
                          <span className="absolute bottom-1 right-1.5 text-[10px] text-[--color-text-disabled] opacity-0 group-hover:opacity-100 transition-opacity select-none">+ add</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 mt-3 text-small text-[--color-text-secondary]">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: "var(--color-secondary)" }} />
            Build meeting
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: "var(--color-primary)" }} />
            Today
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-[--color-success] font-bold text-xs">KICKOFF</span>
            Season kickoff
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-[--color-primary] font-bold text-xs">WEEK 0</span>
            Robot complete deadline
          </span>
          {isLeadership && (
            <span className="ml-auto italic">Click a day to add a meeting · Click an event to edit</span>
          )}
        </div>
      </div>

      {/* ── Meeting detail / edit dialog ── */}
      {selected && (
        <MeetingDialog
          meeting={selected}
          allTasks={allTasks}
          isLeadership={isLeadership}
          onCancel={handleCancel}
          onRestore={handleRestore}
          onClose={() => setSelected(null)}
          onSave={(id, data) => {
            startTransition(async () => {
              await updateMeetingAction(id, data);
              setSelected(null);
              router.refresh();
            });
          }}
        />
      )}

      {/* ── Add meeting dialog ── */}
      {showAdd && (
        <AddMeetingDialog
          defaultDate={addDate}
          onClose={() => setShowAdd(false)}
          onSave={(fd) => {
            startTransition(async () => {
              await addMeetingAction(season.id, fd);
              setShowAdd(false);
              router.refresh();
            });
          }}
        />
      )}
    </>
  );
}

// ─── Meeting detail / edit dialog ─────────────────────────────────────────────

function MeetingDialog({
  meeting, allTasks, isLeadership, onCancel, onRestore, onClose, onSave,
}: {
  meeting: Meeting;
  allTasks: TaskOption[];
  isLeadership: boolean;
  onCancel: (id: string, reason?: string) => void;
  onRestore: (id: string) => void;
  onClose: () => void;
  onSave: (id: string, data: any) => void;
}) {
  const date = new Date(meeting.date);
  const dateLabel = date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  const [editing,    setEditing]    = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [title,      setTitle]      = useState(meeting.title ?? "");
  const [notes,      setNotes]      = useState(meeting.notes ?? "");
  const [startTime,  setStartTime]  = useState(meeting.startTime);
  const [endTime,    setEndTime]    = useState(meeting.endTime);
  const [selectedTasks, setSelectedTasks] = useState<string[]>(meeting.tasks.map(t => t.id));

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={meeting.title ?? "Build meeting"} description={dateLabel}>
        <div className="space-y-4">
          {meeting.cancelled && (
            <div className="rounded-md bg-[--color-danger]/10 border border-[--color-danger]/20 px-3 py-2 text-sm text-[--color-danger]">
              Cancelled{meeting.cancelReason ? ` — ${meeting.cancelReason}` : ""}
            </div>
          )}

          {!editing ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                {[["Start", fmt12(meeting.startTime)], ["End", fmt12(meeting.endTime)]].map(([l, v]) => (
                  <div key={l} className="rounded-md bg-[--color-surface-overlay] px-3 py-2">
                    <p className="text-label text-[--color-text-secondary]">{l}</p>
                    <p className="text-sm font-medium text-[--color-text-primary]">{v}</p>
                  </div>
                ))}
              </div>
              {meeting.notes && (
                <div>
                  <p className="text-label text-[--color-text-secondary] mb-1">Agenda / notes</p>
                  <p className="text-sm text-[--color-text-primary] whitespace-pre-wrap">{meeting.notes}</p>
                </div>
              )}
              {meeting.tasks.length > 0 && (
                <div>
                  <p className="text-label text-[--color-text-secondary] mb-2">Linked tasks</p>
                  <div className="space-y-1">
                    {meeting.tasks.map((t) => (
                      <div key={t.id} className="flex items-center gap-2 text-sm text-[--color-text-primary]">
                        <span className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: SUBTEAM_COLORS[t.subTeam ?? ""] ?? "#64748B" }} />
                        {t.name}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Cancel-meeting inline form */}
              {cancelling && (
                <div className="rounded-md border border-[--color-danger]/30 bg-[--color-danger]/5 p-3 space-y-3">
                  <p className="text-sm font-medium text-[--color-danger]">Cancel this meeting?</p>
                  <input
                    type="text"
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="Reason (optional)"
                    className="h-9 w-full rounded-md border border-[--color-border] bg-[--color-surface] px-3 text-sm text-[--color-text-primary] focus:outline-none focus:border-[--color-primary]"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Button variant="danger" size="sm" onClick={() => { onCancel(meeting.id, cancelReason || undefined); setCancelling(false); }}>
                      Confirm cancel
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => { setCancelling(false); setCancelReason(""); }}>
                      Keep meeting
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                {isLeadership && !cancelling && (
                  <>
                    <Button size="sm" onClick={() => setEditing(true)}>Edit</Button>
                    {meeting.cancelled
                      ? <Button variant="outline" size="sm" onClick={() => onRestore(meeting.id)}>Restore</Button>
                      : <Button variant="danger" size="sm" onClick={() => setCancelling(true)}>Cancel meeting</Button>}
                  </>
                )}
                <DialogClose asChild>
                  <Button variant="outline" size="sm">Close</Button>
                </DialogClose>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <Field label="Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Drivetrain sprint" />
              <div className="grid grid-cols-2 gap-3">
                {[["Start time","startTime",startTime,setStartTime],["End time","endTime",endTime,setEndTime]].map(([label,,val,setter]:any) => (
                  <div key={label}>
                    <label className="text-label font-medium text-[--color-text-primary] block mb-1.5">{label}</label>
                    <input type="time" value={val} onChange={(e) => setter(e.target.value)}
                      className="h-11 w-full rounded-md border border-[--color-border] bg-[--color-surface] px-3 text-sm text-[--color-text-primary] focus:outline-none focus:border-[--color-primary]" />
                  </div>
                ))}
              </div>
              <Textarea label="Agenda / notes" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Topics for this meeting..." />
              {allTasks.length > 0 && (
                <div>
                  <p className="text-label font-medium text-[--color-text-primary] mb-2">Link tasks</p>
                  <div className="max-h-40 overflow-y-auto space-y-0.5 rounded-md border border-[--color-border] p-2">
                    {allTasks.map((t) => (
                      <label key={t.id} className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-sm ${
                        selectedTasks.includes(t.id) ? "bg-[--color-primary]/10" : "hover:bg-[--color-surface-overlay]"
                      }`}>
                        <input type="checkbox" checked={selectedTasks.includes(t.id)}
                          onChange={(e) => setSelectedTasks(p => e.target.checked ? [...p, t.id] : p.filter(id => id !== t.id))}
                          className="rounded" />
                        <span className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: SUBTEAM_COLORS[t.subTeam ?? ""] ?? "#64748B" }} />
                        <span className="truncate text-[--color-text-primary]">{t.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex gap-2">
                <Button size="sm" onClick={() => onSave(meeting.id, { title: title || null, notes: notes || null, startTime, endTime, taskIds: selectedTasks })}>Save</Button>
                <Button variant="outline" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Add meeting dialog ────────────────────────────────────────────────────────

function AddMeetingDialog({ defaultDate, onClose, onSave }: {
  defaultDate: string;
  onClose: () => void;
  onSave: (fd: FormData) => void;
}) {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title="Add meeting">
        <form onSubmit={(e) => { e.preventDefault(); onSave(new FormData(e.currentTarget)); }} className="space-y-4">
          <Field label="Date" name="date" type="date" required defaultValue={defaultDate || new Date().toISOString().split("T")[0]} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start time" name="startTime" type="time" required defaultValue="15:00" />
            <Field label="End time"   name="endTime"   type="time" required defaultValue="20:00" />
          </div>
          <Field label="Title (optional)" name="title" placeholder="e.g. Weekend build sprint" />
          <div className="flex gap-2 pt-2">
            <Button type="submit">Add meeting</Button>
            <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

