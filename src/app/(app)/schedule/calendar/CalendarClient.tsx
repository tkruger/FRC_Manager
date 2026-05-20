"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  updateMeetingAction, cancelMeetingAction, restoreMeetingAction,
  addMeetingAction, generateMeetingsAction,
} from "@/app/actions/meetings";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogClose } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { SUBTEAM_COLORS } from "@/lib/schedule-helpers";

// ─── Types ───────────────────────────────────────────────────────────────────

interface MeetingTask { id: string; name: string; status: string; subTeam: string | null; }
interface Meeting {
  id: string; date: string; startTime: string; endTime: string;
  title: string | null; notes: string | null; cancelled: boolean; cancelReason: string | null;
  tasks: MeetingTask[];
}
interface TaskOption { id: string; name: string; status: string; subTeam: string | null; dueDate: string | null; }
interface Season { id: string; name: string; kickoffDate: string; week0Date: string; meetingDays: string[]; calendarToken: string | null; }

interface Props {
  season: Season;
  meetings: Meeting[];
  allTasks: TaskOption[];
  isLeadership: boolean;
  nextauthUrl: string;
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const WEEK_DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function fmt12(time24: string) {
  const [h, m] = time24.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12  = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function CalendarClient({ season, meetings, allTasks, isLeadership, nextauthUrl }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [selected, setSelected]       = useState<Meeting | null>(null);
  const [showAdd, setShowAdd]         = useState(false);
  const [generating, setGenerating]   = useState(false);

  // Determine month range for the calendar
  const kickoff = new Date(season.kickoffDate);
  const week0   = new Date(season.week0Date);

  // Build a map of date-string → meetings
  const meetingMap: Record<string, Meeting[]> = {};
  for (const m of meetings) {
    const key = m.date.slice(0, 10);
    if (!meetingMap[key]) meetingMap[key] = [];
    meetingMap[key].push(m);
  }

  // Generate months from kickoff to week0
  const months: Date[] = [];
  const cur = new Date(kickoff.getFullYear(), kickoff.getMonth(), 1);
  const endMon = new Date(week0.getFullYear(), week0.getMonth(), 1);
  while (cur <= endMon) {
    months.push(new Date(cur));
    cur.setMonth(cur.getMonth() + 1);
  }

  function handleGenerate() {
    if (!confirm("This will replace all existing auto-generated meetings with fresh ones based on the season config. Manually edited meetings will be overwritten. Continue?")) return;
    setGenerating(true);
    startTransition(async () => {
      const res = await generateMeetingsAction(season.id);
      setGenerating(false);
      if (res.success) router.refresh();
    });
  }

  function handleCancel(meetingId: string) {
    const reason = prompt("Reason for cancellation (optional):") ?? undefined;
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

  const icsUrl = season.calendarToken ? `${nextauthUrl}/api/calendar/${season.calendarToken}.ics` : null;
  const publicUrl = season.calendarToken ? `${nextauthUrl}/public/schedule/${season.calendarToken}` : null;

  return (
    <>
      {/* Controls */}
      <div className="px-4 sm:px-6 lg:px-8 flex flex-wrap gap-2 items-center">
        {isLeadership && (
          <>
            <Button variant="outline" size="sm" onClick={handleGenerate} isLoading={generating}>
              {meetings.length > 0 ? "Regenerate from config" : "Generate meetings from config"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowAdd(true)}>+ Add meeting</Button>
          </>
        )}
        {icsUrl && (
          <a href={icsUrl} className="text-small text-[--color-secondary] hover:underline">
            Subscribe to calendar (.ics)
          </a>
        )}
        {publicUrl && (
          <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="text-small text-[--color-secondary] hover:underline">
            Public schedule ↗
          </a>
        )}
        <span className="text-small text-[--color-text-secondary] ml-auto">
          {meetings.filter((m) => !m.cancelled).length} meetings · {meetings.filter((m) => m.cancelled).length} cancelled
        </span>
      </div>

      {/* Month grids */}
      <div className="space-y-8 px-4 sm:px-6 lg:px-8">
        {months.map((month) => {
          const year   = month.getFullYear();
          const mo     = month.getMonth();
          const daysInMonth = new Date(year, mo + 1, 0).getDate();
          const startDow    = new Date(year, mo, 1).getDay(); // 0=Sun

          return (
            <div key={`${year}-${mo}`}>
              <h2 className="text-h3 text-[--color-text-primary] mb-3">
                {MONTHS[mo]} {year}
              </h2>

              {/* Day-of-week headers */}
              <div className="grid grid-cols-7 mb-1">
                {WEEK_DAYS.map((d) => (
                  <div key={d} className="text-center text-label text-[--color-text-secondary] py-1">{d}</div>
                ))}
              </div>

              {/* Calendar grid */}
              <div className="grid grid-cols-7 border-l border-t border-[--color-border]/40">
                {/* Leading empty cells */}
                {Array.from({ length: startDow }).map((_, i) => (
                  <div key={`empty-${i}`} className="border-r border-b border-[--color-border]/40 min-h-[80px] bg-[--color-surface-overlay]/20" />
                ))}

                {/* Day cells */}
                {Array.from({ length: daysInMonth }).map((_, idx) => {
                  const dayNum = idx + 1;
                  const dateObj = new Date(year, mo, dayNum);
                  const key     = dateObj.toISOString().slice(0, 10);
                  const dayMeetings = meetingMap[key] ?? [];
                  const isKickoff  = key === season.kickoffDate.slice(0, 10);
                  const isWeek0    = key === season.week0Date.slice(0, 10);
                  const isToday    = key === new Date().toISOString().slice(0, 10);
                  const isPast     = dateObj < new Date(new Date().toDateString());

                  return (
                    <div
                      key={key}
                      className={`border-r border-b border-[--color-border]/40 min-h-[80px] p-1.5 ${isPast ? "bg-[--color-surface-overlay]/10" : ""}`}
                    >
                      {/* Day number */}
                      <div className={`text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full ${
                        isToday ? "text-white" : "text-[--color-text-secondary]"
                      }`}
                        style={isToday ? { backgroundColor: "var(--color-primary)" } : undefined}>
                        {dayNum}
                      </div>

                      {/* Season markers */}
                      {isKickoff && <div className="text-[10px] font-bold text-[--color-success] mb-0.5">KICKOFF</div>}
                      {isWeek0   && <div className="text-[10px] font-bold text-[--color-primary] mb-0.5">WEEK 0</div>}

                      {/* Meeting chips */}
                      {dayMeetings.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => setSelected(m)}
                          className={`w-full text-left text-[10px] rounded px-1.5 py-0.5 mb-0.5 truncate font-medium transition-opacity ${
                            m.cancelled
                              ? "line-through opacity-40 bg-[--color-surface-overlay] text-[--color-text-secondary]"
                              : "text-white hover:opacity-90"
                          }`}
                          style={!m.cancelled ? { backgroundColor: "var(--color-secondary)" } : undefined}
                        >
                          {fmt12(m.startTime)} {m.title ?? "Build meeting"}
                        </button>
                      ))}

                      {/* Add meeting shortcut for leaders */}
                      {isLeadership && dayMeetings.length === 0 && !isPast && (
                        <button
                          className="w-full text-[10px] text-[--color-text-disabled] hover:text-[--color-secondary] text-left px-1 py-0.5"
                          onClick={() => setShowAdd(true)}
                        >
                          + add
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Meeting detail / edit dialog */}
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

      {/* Add meeting dialog */}
      {showAdd && (
        <AddMeetingDialog
          seasonId={season.id}
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
  onCancel: (id: string) => void;
  onRestore: (id: string) => void;
  onClose: () => void;
  onSave: (id: string, data: any) => void;
}) {
  const date = new Date(meeting.date);
  const dateLabel = date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  const [editing, setEditing]       = useState(false);
  const [title, setTitle]           = useState(meeting.title ?? "");
  const [notes, setNotes]           = useState(meeting.notes ?? "");
  const [startTime, setStartTime]   = useState(meeting.startTime);
  const [endTime, setEndTime]       = useState(meeting.endTime);
  const [selectedTasks, setSelectedTasks] = useState<string[]>(meeting.tasks.map((t) => t.id));

  function save() {
    onSave(meeting.id, { title: title || null, notes: notes || null, startTime, endTime, taskIds: selectedTasks });
    setEditing(false);
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={meeting.title ?? "Build meeting"} description={dateLabel}>
        <div className="space-y-4">
          {meeting.cancelled && (
            <div className="rounded-md bg-[--color-danger]/10 border border-[--color-danger]/20 px-3 py-2 text-sm text-[--color-danger]">
              ❌ Cancelled{meeting.cancelReason ? ` — ${meeting.cancelReason}` : ""}
            </div>
          )}

          {!editing ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-md bg-[--color-surface-overlay] px-3 py-2">
                  <p className="text-label text-[--color-text-secondary]">Start</p>
                  <p className="text-sm font-medium text-[--color-text-primary]">{fmt12(meeting.startTime)}</p>
                </div>
                <div className="rounded-md bg-[--color-surface-overlay] px-3 py-2">
                  <p className="text-label text-[--color-text-secondary]">End</p>
                  <p className="text-sm font-medium text-[--color-text-primary]">{fmt12(meeting.endTime)}</p>
                </div>
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
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: SUBTEAM_COLORS[t.subTeam ?? ""] ?? "#64748B" }} />
                        {t.name}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {isLeadership && (
                <div className="flex gap-2 pt-2">
                  <Button size="sm" onClick={() => setEditing(true)}>Edit meeting</Button>
                  {meeting.cancelled
                    ? <Button variant="outline" size="sm" onClick={() => onRestore(meeting.id)}>Restore</Button>
                    : <Button variant="danger" size="sm" onClick={() => onCancel(meeting.id)}>Cancel meeting</Button>}
                  <DialogClose asChild><Button variant="outline" size="sm">Close</Button></DialogClose>
                </div>
              )}
              {!isLeadership && (
                <DialogClose asChild><Button variant="outline">Close</Button></DialogClose>
              )}
            </>
          ) : (
            <div className="space-y-4">
              <Field label="Meeting title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Drivetrain build sprint" />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-label font-medium text-[--color-text-primary] block mb-1.5">Start time</label>
                  <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)}
                    className="h-11 w-full rounded-md border border-[--color-border] bg-[--color-surface] px-3 text-sm text-[--color-text-primary] focus:outline-none focus:border-[--color-primary]" />
                </div>
                <div>
                  <label className="text-label font-medium text-[--color-text-primary] block mb-1.5">End time</label>
                  <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)}
                    className="h-11 w-full rounded-md border border-[--color-border] bg-[--color-surface] px-3 text-sm text-[--color-text-primary] focus:outline-none focus:border-[--color-primary]" />
                </div>
              </div>
              <Textarea label="Agenda / notes" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Topics, goals, or links for this meeting..." />

              {allTasks.length > 0 && (
                <div>
                  <p className="text-label font-medium text-[--color-text-primary] mb-2">Link tasks to this meeting</p>
                  <div className="max-h-40 overflow-y-auto space-y-0.5 rounded-md border border-[--color-border] p-2">
                    {allTasks.map((t) => (
                      <label key={t.id} className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-sm transition-colors ${
                        selectedTasks.includes(t.id) ? "bg-[--color-primary]/10" : "hover:bg-[--color-surface-overlay]"
                      }`}>
                        <input type="checkbox" checked={selectedTasks.includes(t.id)}
                          onChange={(e) => setSelectedTasks((prev) => e.target.checked ? [...prev, t.id] : prev.filter((id) => id !== t.id))}
                          className="rounded" />
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: SUBTEAM_COLORS[t.subTeam ?? ""] ?? "#64748B" }} />
                        <span className="text-[--color-text-primary] truncate">{t.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button size="sm" onClick={save}>Save</Button>
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

function AddMeetingDialog({ seasonId, onClose, onSave }: {
  seasonId: string;
  onClose: () => void;
  onSave: (fd: FormData) => void;
}) {
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    onSave(new FormData(e.currentTarget));
  }

  const today = new Date().toISOString().split("T")[0];

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title="Add meeting">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Date" name="date" type="date" required defaultValue={today} />
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
