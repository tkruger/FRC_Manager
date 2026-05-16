"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { createSeasonAction } from "@/app/actions/season";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";

const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const DAY_LABELS: Record<string, string> = { MON: "Mon", TUE: "Tue", WED: "Wed", THU: "Thu", FRI: "Fri", SAT: "Sat", SUN: "Sun" };

export function SeasonForm() {
  const router = useRouter();
  const [state, action, pending] = useActionState(createSeasonAction, null);
  const [selectedDays, setSelectedDays] = useState<string[]>(["MON", "WED", "FRI", "SAT"]);
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    if (state?.success) router.refresh();
  }, [state, router]);

  function toggleDay(day: string) {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  }

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

      {/* Meeting days */}
      <div>
        <label className="block text-label font-medium text-[--color-text-primary] mb-2">
          Build meeting days <span className="text-[--color-danger]">*</span>
        </label>
        <div className="flex gap-2 flex-wrap">
          {DAYS.map((day) => {
            const active = selectedDays.includes(day);
            return (
              <button
                key={day}
                type="button"
                onClick={() => toggleDay(day)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${
                  active
                    ? "bg-[--color-primary] text-white border-[--color-primary]"
                    : "border-[--color-border] text-[--color-text-secondary] hover:border-[--color-primary] hover:text-[--color-primary]"
                }`}
              >
                {DAY_LABELS[day]}
              </button>
            );
          })}
        </div>
        {selectedDays.map((d) => (
          <input key={d} type="hidden" name="meetingDays" value={d} />
        ))}
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
