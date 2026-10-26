"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateSeasonAction } from "@/app/actions/season";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { scheduleSlots, type Slot } from "@/lib/meeting-schedule";
import { MeetingScheduleFields } from "./MeetingScheduleFields";
import { LinkedDates } from "@/components/ui/linked-dates";

interface Season {
  id: string;
  name: string;
  year: number;
  /** The season's first day */
  startDate: Date;
  /** The FRC kickoff (null: not set — the start date is used) */
  kickoffDate: Date | null;
  endDate: Date;
  startLocked: boolean;
  meetingDays: string[];
  meetingStartTime: string;
  meetingEndTime: string;
  /** Each day's meetings: { MON: [{ start, end }, …] } (older seasons: one { start, end }) */
  meetingDayTimes: Record<string, Slot[] | Slot> | null;
  expectedAttendance: number;
}

export function EditSeasonForm({ season, onClose }: { season: Season; onClose: () => void }) {
  const router = useRouter();

  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Submitted by hand (not a form action) so a failed save keeps what was typed
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await updateSeasonAction(season.id, null, fd);
      if (!res.success) { setError(res.error); return; }
      const m = res.meetings;
      const parts = m ? [m.moved && `${m.moved} moved`, m.added && `${m.added} added`, m.removed && `${m.removed} removed`].filter(Boolean) : [];
      const moved = parts.length ? ` — future meetings: ${parts.join(", ")}` : "";
      toast.success(`Season saved${moved}`);
      router.refresh(); onClose();
    });
  }

  function toDateInputValue(d: Date) {
    return new Date(d).toISOString().split("T")[0];
  }


  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="rounded-md bg-(--color-danger)/10 border border-(--color-danger)/20 px-4 py-3 text-sm text-(--color-danger)">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Season name" name="name" required defaultValue={season.name} />
        <Field label="Season year" name="year" type="number" required defaultValue={season.year} min={2000} max={2100} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* The form field is still named kickoffDate — it's the season's start */}
        <Field label="Start date" name="kickoffDate" type="date" required defaultValue={toDateInputValue(season.startDate)}
          readOnly={season.startLocked} aria-readonly={season.startLocked}
          className={season.startLocked ? "opacity-60 cursor-not-allowed" : undefined}
          hint={season.startLocked ? "Locked — the season has started" : "The season's first day. Changing it updates future meetings."} />
        <Field label="Kickoff" name="gameKickoff" type="date" defaultValue={season.kickoffDate ? toDateInputValue(season.kickoffDate) : ""}
          hint="FRC kickoff. Template tasks counted from kickoff use it — empty means the start date." />
        <Field label="End date" name="endDate" type="date" required defaultValue={toDateInputValue(season.endDate)}
          hint="After your last competition. Changing it updates future meetings." />
        <LinkedDates start="kickoffDate" end="endDate" />
      </div>

      <MeetingScheduleFields initialDays={season.meetingDays} initialSlots={scheduleSlots(season)} />

      <Field label="Expected attendance" name="expectedAttendance" type="number" defaultValue={season.expectedAttendance} min={1} />

      <div className="flex gap-3">
        <Button type="submit" isLoading={pending}>Save changes</Button>
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
      </div>
    </form>
  );
}
