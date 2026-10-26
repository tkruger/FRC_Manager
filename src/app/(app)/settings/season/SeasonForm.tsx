"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSeasonAction } from "@/app/actions/season";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { MeetingScheduleFields } from "./MeetingScheduleFields";
import { LinkedDates } from "@/components/ui/linked-dates";

const DEFAULT_DAYS = ["MON", "WED", "FRI", "SAT"];

/**
 * A new season — this year's or a future one. It becomes active by itself when its dates
 * start (see season-active). A failed save keeps everything typed (no form reset).
 */
export function SeasonForm({ onClose }: { onClose?: () => void } = {}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const currentYear = new Date().getFullYear();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await createSeasonAction(null, fd);
      if (!res.success) { setError(res.error); return; }
      toast.success(res.active ? "Season created — it's the active season" : "Season created — it becomes active when it starts");
      router.refresh();
      onClose?.();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="rounded-md bg-(--color-danger)/10 border border-(--color-danger)/20 px-4 py-3 text-sm text-(--color-danger)">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Season name" name="name" required placeholder={`${currentYear} Season`} />
        <Field label="Season year" name="year" type="number" required defaultValue={currentYear} min={2000} max={2100} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* The form field is still named kickoffDate — it's the season's start */}
        <Field label="Start date" name="kickoffDate" type="date" required hint="The season's first day" />
        <Field label="Kickoff" name="gameKickoff" type="date" hint="FRC kickoff — template “kickoff” tasks count from it (empty: the start date)" />
        <Field label="End date" name="endDate" type="date" required hint="After your last competition" />
        <LinkedDates start="kickoffDate" end="endDate" />
      </div>
      <p className="text-small text-(--color-text-secondary) -mt-2">
        You can set up a future season ahead of time. The season today falls in is active automatically; a future one takes over on its start date.
      </p>

      <MeetingScheduleFields initialDays={DEFAULT_DAYS} />

      <Field label="Expected attendance" name="expectedAttendance" type="number" defaultValue={15} min={1}
        hint="Typical number of students present per meeting" />

      <div className="flex gap-3">
        <Button type="submit" isLoading={pending}>Create season</Button>
        {onClose && <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>}
      </div>
    </form>
  );
}
