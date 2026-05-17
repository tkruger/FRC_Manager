"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { updateSeasonAction } from "@/app/actions/season";
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

interface Season {
  id: string;
  name: string;
  year: number;
  kickoffDate: Date;
  week0Date: Date;
  meetingDays: string[];
  meetingStartTime: string;
  meetingEndTime: string;
  expectedAttendance: number;
}

interface Props {
  season: Season;
  onClose: () => void;
}

export function EditSeasonForm({ season, onClose }: Props) {
  const router = useRouter();

  const boundAction = updateSeasonAction.bind(null, season.id);
  const [state, action, pending] = useActionState(boundAction, null);

  useEffect(() => {
    if (state?.success) {
      router.refresh();
      onClose();
    }
  }, [state, router, onClose]);

  function toDateInputValue(d: Date) {
    return new Date(d).toISOString().split("T")[0];
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

      {/* Meeting days */}
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
                defaultChecked={season.meetingDays.includes(value)}
                className="sr-only peer"
              />
              <span className="inline-flex items-center justify-center px-4 py-2 rounded-md text-sm font-medium border transition-colors
                border-[--color-border] text-[--color-text-secondary]
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
        <Field label="Meeting start" name="meetingStartTime" type="time" required defaultValue={season.meetingStartTime} />
        <Field label="Meeting end" name="meetingEndTime" type="time" required defaultValue={season.meetingEndTime} />
        <Field label="Expected attendance" name="expectedAttendance" type="number" defaultValue={season.expectedAttendance} min={1} />
      </div>

      <div className="flex gap-3">
        <Button type="submit" isLoading={pending}>Save changes</Button>
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
      </div>
    </form>
  );
}
