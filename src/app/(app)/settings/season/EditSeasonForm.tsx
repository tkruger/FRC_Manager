"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { updateSeasonAction } from "@/app/actions/season";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";

const DAYS = [
  { value: "MON", label: "Monday" },
  { value: "TUE", label: "Tuesday" },
  { value: "WED", label: "Wednesday" },
  { value: "THU", label: "Thursday" },
  { value: "FRI", label: "Friday" },
  { value: "SAT", label: "Saturday" },
  { value: "SUN", label: "Sunday" },
];

interface DayTime { start: string; end: string; }

interface Season {
  id: string;
  name: string;
  year: number;
  kickoffDate: Date;
  week0Date: Date;
  meetingDays: string[];
  meetingStartTime: string;
  meetingEndTime: string;
  meetingDayTimes: Record<string, DayTime> | null;
  expectedAttendance: number;
}

export function EditSeasonForm({ season, onClose }: { season: Season; onClose: () => void }) {
  const router = useRouter();

  const boundAction = updateSeasonAction.bind(null, season.id);
  const [state, action, pending] = useActionState(boundAction, null);
  const [selectedDays, setSelectedDays] = useState<string[]>(season.meetingDays);

  useEffect(() => {
    if (state?.success) { router.refresh(); onClose(); }
  }, [state, router, onClose]);

  function toDateInputValue(d: Date) {
    return new Date(d).toISOString().split("T")[0];
  }

  function defaultStart(day: string) {
    return season.meetingDayTimes?.[day]?.start ?? season.meetingStartTime;
  }
  function defaultEnd(day: string) {
    return season.meetingDayTimes?.[day]?.end ?? season.meetingEndTime;
  }

  return (
    <form action={action} className="space-y-5">
      {state && !state.success && (
        <div className="rounded-md bg-[--color-danger]/10 border border-[--color-danger]/20 px-4 py-3 text-sm text-[--color-danger]">
          {state.error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Season name" name="name" required defaultValue={season.name} />
        <Field label="Season year" name="year" type="number" required defaultValue={season.year} min={2000} max={2100} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Kickoff date" name="kickoffDate" type="date" required defaultValue={toDateInputValue(season.kickoffDate)} />
        <Field label="Week 0 date" name="week0Date" type="date" required defaultValue={toDateInputValue(season.week0Date)}
          hint="Your internal robot-complete deadline" />
      </div>

      {/* Per-day meeting times */}
      <div>
        <p className="block text-label font-medium text-[--color-text-primary] mb-1">
          Build meeting days &amp; times <span className="text-[--color-danger]">*</span>
        </p>
        <p className="text-small text-[--color-text-secondary] mb-3">
          Toggle days and set individual start/end times for each.
        </p>
        <div className="rounded-md border border-[--color-border] overflow-hidden divide-y divide-[--color-border]/40">
          {DAYS.map(({ value, label }) => {
            const checked = selectedDays.includes(value);
            return (
              <div key={value} className={`flex items-center gap-3 px-3 py-3 transition-colors ${checked ? "bg-[--color-primary]/8" : "hover:bg-[--color-surface-overlay]"}`}>
                <label className="flex items-center gap-3 cursor-pointer flex-shrink-0 min-w-[140px]">
                  <input
                    type="checkbox"
                    name="meetingDays"
                    value={value}
                    checked={checked}
                    onChange={(e) => setSelectedDays((prev) =>
                      e.target.checked ? [...prev, value] : prev.filter((d) => d !== value)
                    )}
                    className="rounded flex-shrink-0"
                  />
                  <span className="text-sm text-[--color-text-primary]">{label}</span>
                </label>
                {checked && (
                  <div className="flex items-center gap-2 ml-auto">
                    <span className="text-small text-[--color-text-secondary]">Start</span>
                    <input
                      type="time"
                      name={`dayStart_${value}`}
                      defaultValue={defaultStart(value)}
                      className="h-8 rounded border border-[--color-border] bg-[--color-surface] px-2 text-sm text-[--color-text-primary] focus:outline-none focus:border-[--color-primary]"
                    />
                    <span className="text-small text-[--color-text-secondary]">End</span>
                    <input
                      type="time"
                      name={`dayEnd_${value}`}
                      defaultValue={defaultEnd(value)}
                      className="h-8 rounded border border-[--color-border] bg-[--color-surface] px-2 text-sm text-[--color-text-primary] focus:outline-none focus:border-[--color-primary]"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <Field label="Expected attendance" name="expectedAttendance" type="number" defaultValue={season.expectedAttendance} min={1} />

      <div className="flex gap-3">
        <Button type="submit" isLoading={pending}>Save changes</Button>
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
      </div>
    </form>
  );
}
