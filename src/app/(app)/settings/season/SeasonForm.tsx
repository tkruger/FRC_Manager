"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createSeasonAction } from "@/app/actions/season";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";

const DAYS = [
  { value: "MON", label: "Mon" },
  { value: "TUE", label: "Tue" },
  { value: "WED", label: "Wed" },
  { value: "THU", label: "Thu" },
  { value: "FRI", label: "Fri" },
  { value: "SAT", label: "Sat" },
  { value: "SUN", label: "Sun" },
];

const DEFAULT_DAYS = ["MON", "WED", "FRI", "SAT"];

export function SeasonForm() {
  const router = useRouter();
  const [state, action, pending] = useActionState(createSeasonAction, null);
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    if (state?.success) router.refresh();
  }, [state, router]);

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
        <Field label="Kickoff date" name="kickoffDate" type="date" required />
        <Field label="Week 0 date" name="week0Date" type="date" required hint="Your internal robot-complete deadline" />
      </div>

      {/* Meeting days — real checkboxes styled as toggle buttons */}
      <div>
        <p className="block text-label font-medium text-[--color-text-primary] mb-2">
          Build meeting days <span className="text-[--color-danger]">*</span>
        </p>
        <div className="flex gap-2 flex-wrap">
          {DAYS.map(({ value, label }) => (
            <label key={value} className="cursor-pointer select-none">
              <input
                type="checkbox"
                name="meetingDays"
                value={value}
                defaultChecked={DEFAULT_DAYS.includes(value)}
                className="sr-only peer"
              />
              <span className="inline-flex items-center justify-center px-4 py-2 rounded-md text-sm font-medium border transition-colors
                bg-[--color-surface] border-[--color-border] text-[--color-text-secondary]
                peer-checked:bg-[--color-primary] peer-checked:text-white peer-checked:border-[--color-primary]
                hover:border-[--color-primary] hover:text-[--color-primary]
                peer-checked:hover:brightness-90">
                {label}
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Field label="Meeting start" name="meetingStartTime" type="time" required defaultValue="15:00" />
        <Field label="Meeting end" name="meetingEndTime" type="time" required defaultValue="20:00" />
        <Field label="Expected attendance" name="expectedAttendance" type="number" defaultValue={15} min={1} />
      </div>

      <Button type="submit" isLoading={pending}>Activate season</Button>
    </form>
  );
}
