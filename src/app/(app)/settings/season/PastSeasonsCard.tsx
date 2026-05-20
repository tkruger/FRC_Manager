"use client";

import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

interface Robot { id: string; displayName: string; role: string; status: string; }
interface Season {
  id: string; name: string; year: number;
  kickoffDate: string; week0Date: string;
  meetingDays: string[];
  meetingStartTime: string; meetingEndTime: string;
  meetingDayTimes: Record<string, { start: string; end: string }> | null;
  expectedAttendance: number;
  robots: Robot[];
  taskCount: number; taskComplete: number; meetingCount: number;
}

const DAY_LABELS: Record<string, string> = {
  MON:"Mon", TUE:"Tue", WED:"Wed", THU:"Thu", FRI:"Fri", SAT:"Sat", SUN:"Sun",
};

const ROBOT_ROLE_LABELS: Record<string, string> = {
  COMPETITION:"Competition Bot", PRACTICE:"Practice Bot", DEMO:"Demo Bot", OTHER:"Other",
};

function fmt12(t: string) {
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2,"0")} ${h >= 12 ? "PM" : "AM"}`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" });
}

export function PastSeasonsCard({ seasons }: { seasons: Season[] }) {
  const [selected, setSelected] = useState<Season | null>(null);

  return (
    <>
      <div className="card">
        <h2 className="text-h3 text-[--color-text-primary] mb-3">Past seasons</h2>
        <div className="divide-y divide-[--color-border]/60">
          {seasons.map((s) => {
            const pct = s.taskCount > 0 ? Math.round((s.taskComplete / s.taskCount) * 100) : 0;
            return (
              <button
                key={s.id}
                onClick={() => setSelected(s)}
                className="w-full flex items-center justify-between py-3 text-left hover:bg-[--color-surface-overlay] -mx-5 px-5 transition-colors group first:rounded-t-md last:rounded-b-md"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-[--color-text-primary] group-hover:text-[--color-primary] transition-colors">
                    {s.name}
                  </span>
                  <span className="text-small text-[--color-text-secondary]">{s.year}</span>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  {s.taskCount > 0 && (
                    <span className="text-small text-[--color-text-secondary]">
                      {pct}% tasks done
                    </span>
                  )}
                  <span className="text-small text-[--color-text-secondary]">
                    {s.robots.length} robot{s.robots.length !== 1 ? "s" : ""}
                  </span>
                  <span className="text-small text-[--color-secondary]">View →</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Detail modal */}
      {selected && (
        <Dialog open onOpenChange={(o) => !o && setSelected(null)}>
          <DialogContent title={selected.name} description={`${selected.year} build season`} className="sm:max-w-xl">
            <div className="space-y-5">

              {/* Key dates */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-md bg-[--color-surface-overlay] px-3 py-2">
                  <p className="text-label text-[--color-text-secondary]">Kickoff</p>
                  <p className="text-sm font-medium text-[--color-text-primary]">{fmtDate(selected.kickoffDate)}</p>
                </div>
                <div className="rounded-md bg-[--color-surface-overlay] px-3 py-2">
                  <p className="text-label text-[--color-text-secondary]">Week 0</p>
                  <p className="text-sm font-medium text-[--color-text-primary]">{fmtDate(selected.week0Date)}</p>
                </div>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Meetings", value: selected.meetingCount },
                  { label: "Tasks", value: selected.taskCount },
                  {
                    label: "Completed",
                    value: selected.taskCount > 0
                      ? `${Math.round((selected.taskComplete / selected.taskCount) * 100)}%`
                      : "—",
                  },
                ].map((s) => (
                  <div key={s.label} className="rounded-md bg-[--color-surface-overlay] px-3 py-2 text-center">
                    <p className="text-h2 text-[--color-text-primary]">{s.value}</p>
                    <p className="text-label text-[--color-text-secondary]">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Meeting schedule */}
              <div>
                <p className="text-label font-medium text-[--color-text-secondary] uppercase tracking-wide mb-2">Meeting schedule</p>
                <div className="rounded-md border border-[--color-border] overflow-hidden divide-y divide-[--color-border]/40">
                  {selected.meetingDays.map((day) => {
                    const times = selected.meetingDayTimes?.[day];
                    const start = times?.start ?? selected.meetingStartTime;
                    const end   = times?.end   ?? selected.meetingEndTime;
                    return (
                      <div key={day} className="flex items-center justify-between px-3 py-2">
                        <span className="text-sm text-[--color-text-primary]">{DAY_LABELS[day] ?? day}</span>
                        <span className="text-small text-[--color-text-secondary]">{fmt12(start)} – {fmt12(end)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Robots */}
              {selected.robots.length > 0 && (
                <div>
                  <p className="text-label font-medium text-[--color-text-secondary] uppercase tracking-wide mb-2">Robots</p>
                  <div className="space-y-2">
                    {selected.robots.map((r) => (
                      <div key={r.id} className="flex items-center justify-between rounded-md border border-[--color-border] px-3 py-2.5">
                        <span className="text-sm font-medium text-[--color-text-primary]">{r.displayName}</span>
                        <Badge variant="neutral">{ROBOT_ROLE_LABELS[r.role] ?? r.role}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
