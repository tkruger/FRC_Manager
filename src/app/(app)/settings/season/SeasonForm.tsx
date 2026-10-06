"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSeasonAction } from "@/app/actions/season";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { TimeSelect } from "@/components/ui/time-select";

const DAYS = [
  { value: "MON", label: "Monday" },
  { value: "TUE", label: "Tuesday" },
  { value: "WED", label: "Wednesday" },
  { value: "THU", label: "Thursday" },
  { value: "FRI", label: "Friday" },
  { value: "SAT", label: "Saturday" },
  { value: "SUN", label: "Sunday" },
];

const DEFAULT_DAYS = ["MON", "WED", "FRI", "SAT"];
const DEFAULT_TIMES: Record<string, { start: string; end: string }> = {
  MON: { start: "15:00", end: "20:00" },
  TUE: { start: "15:00", end: "20:00" },
  WED: { start: "15:00", end: "20:00" },
  THU: { start: "15:00", end: "20:00" },
  FRI: { start: "15:00", end: "20:00" },
  SAT: { start: "09:00", end: "17:00" },
  SUN: { start: "09:00", end: "17:00" },
};

export function SeasonForm({ onClose }: { onClose?: () => void } = {}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(createSeasonAction, null);
  const [selectedDays, setSelectedDays] = useState<string[]>(DEFAULT_DAYS);
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    if (state?.success) {
      router.refresh();
      onClose?.();
    }
  }, [state, router, onClose]);

  return (
    <form action={action} className="space-y-5">
      {state && !state.success && (
        <div className="rounded-md bg-[--color-danger]/10 border border-[--color-danger]/20 px-4 py-3 text-sm text-[--color-danger]">
          {state.error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Season name" name="name" required placeholder={`${currentYear} Season`} />
        <Field label="Season year" name="year" type="number" required defaultValue={currentYear} min={2000} max={2100} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Start date" name="kickoffDate" type="date" required hint="Kickoff" />
        <Field label="End date" name="endDate" type="date" required hint="After your last competition" />
      </div>

      {/* Per-day meeting times */}
      <div>
        <p className="block text-sm font-medium text-[--color-text-primary] mb-1">
          Build meeting days &amp; times <span className="text-[--color-danger]">*</span>
        </p>
        <p className="text-small text-[--color-text-secondary] mb-3">
          Select which days the team meets and set the start/end time for each day.
        </p>
        <div className="rounded-md border border-[--color-border] overflow-hidden divide-y divide-[--color-border]/40">
          {DAYS.map(({ value, label }) => {
            const checked = selectedDays.includes(value);
            return (
              <div key={value} className={`flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-3 transition-colors ${checked ? "bg-(--color-primary)/8" : "hover:bg-(--color-surface-overlay)"}`}>
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
                  <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
                    <TimeSelect size="sm" name={`dayStart_${value}`} defaultValue={DEFAULT_TIMES[value]?.start ?? "15:00"} aria-label={`${label} start time`} />
                    <span className="text-small text-(--color-text-secondary)">to</span>
                    <TimeSelect size="sm" name={`dayEnd_${value}`} defaultValue={DEFAULT_TIMES[value]?.end ?? "20:00"} aria-label={`${label} end time`} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <Field label="Expected attendance" name="expectedAttendance" type="number" defaultValue={15} min={1}
        hint="Typical number of students present per meeting" />

      <div className="flex gap-3">
        <Button type="submit" isLoading={pending}>Activate season</Button>
        {onClose && <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>}
      </div>
    </form>
  );
}
