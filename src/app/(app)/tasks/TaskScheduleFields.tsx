"use client";

import { useEffect, useRef, useState } from "react";
import { Field } from "@/components/ui/field";

const DAY = 86_400_000;
const show = (d: Date) => d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
const toDateVal = (d: string | null | undefined) => (d ? new Date(d).toISOString().split("T")[0] : "");

export type ScheduleMode = "dates" | "auto";

/**
 * When a task happens: its own start and due dates, or after its prerequisites — it starts
 * a number of days after the last one is due and takes a number of days (its dates are
 * worked out, and follow them when they move). Submits scheduleMode, startDate/dueDate or
 * durationDays/lagDays.
 */
export function TaskScheduleFields({ initial, prereqDues, kickoffDate, endDate, due, onDueChange }: {
  initial?: { autoSchedule?: boolean; startDate?: string | null; dueDate?: string | null; durationDays?: number | null; lagDays?: number };
  /** Due dates (ISO) of the prerequisites picked in the form */
  prereqDues: (string | null)[];
  kickoffDate?: string;
  endDate?: string;
  /** The due date field, when the parent needs to follow it (YYYY-MM-DD) */
  due?: string;
  onDueChange?: (value: string) => void;
}) {
  const hasPrereqs = prereqDues.length > 0;
  const [mode, setMode] = useState<ScheduleMode>(initial?.autoSchedule ? "auto" : "dates");
  // Length defaults to the task's current dates, if it has them
  const currentLength = initial?.startDate && initial?.dueDate
    ? Math.max(1, Math.round((new Date(initial.dueDate).getTime() - new Date(initial.startDate).getTime()) / DAY))
    : null;
  const [length, setLength] = useState(String(initial?.durationDays ?? currentLength ?? 3));
  const [lag, setLag] = useState(String(initial?.lagDays ?? 0));
  const [ownDue, setOwnDue] = useState(toDateVal(initial?.dueDate));
  const dueValue = due ?? ownDue;
  const setDue = onDueChange ?? setOwnDue;

  // Milestones have no length — follow the form's Milestone checkbox
  const ref = useRef<HTMLDivElement>(null);
  const [milestone, setMilestone] = useState(false);
  useEffect(() => {
    const box = ref.current?.closest("form")?.querySelector<HTMLInputElement>('input[name="isMilestone"]');
    if (!box) return;
    const sync = () => setMilestone(box.checked);
    sync();
    box.addEventListener("change", sync);
    return () => box.removeEventListener("change", sync);
  }, []);

  // Without prerequisites there's nothing to follow
  const auto = mode === "auto" && hasPrereqs;
  const lagN = Math.round(Number(lag) || 0);
  const lenN = milestone ? 0 : Math.max(1, Math.round(Number(length) || 1));
  const dues = prereqDues.filter((d): d is string => !!d).map((d) => new Date(d).getTime());
  const start = dues.length ? new Date(Math.max(...dues) + lagN * DAY) : null;

  const tab = (on: boolean) =>
    `rounded px-3 py-1.5 text-sm font-medium ${on ? "bg-(--color-surface) text-(--color-text-primary) shadow-sm" : "text-(--color-text-secondary)"}`;

  return (
    <div ref={ref} className="space-y-3">
      <div>
        <div className="inline-flex rounded-md bg-(--color-surface-overlay) p-1" role="radiogroup" aria-label="How the dates are set">
          <button type="button" role="radio" aria-checked={!auto} className={tab(!auto)} onClick={() => setMode("dates")}>Set dates</button>
          <button type="button" role="radio" aria-checked={auto} disabled={!hasPrereqs} className={`${tab(auto)} disabled:opacity-50`}
            onClick={() => setMode("auto")} title={hasPrereqs ? undefined : "Pick a prerequisite first"}>
            After prerequisites
          </button>
        </div>
        <p className="mt-1 text-small text-(--color-text-secondary)">
          {auto
            ? "Starts after the last prerequisite is due, and moves when they do."
            : hasPrereqs ? "Or schedule it after its prerequisites, so its dates follow them." : "Pick prerequisites to schedule this task after them instead."}
        </p>
      </div>

      {auto ? (
        <>
          <div className="flex flex-wrap items-center gap-2 text-sm text-(--color-text-secondary)">
            {!milestone && (
              <>
                <span>Takes</span>
                <input type="number" min="1" max="365" required value={length} onChange={(e) => setLength(e.target.value)} aria-label="Days it takes"
                  className="h-10 w-20 rounded-md border border-(--color-border) bg-(--color-surface) px-3 text-(--color-text-primary)" />
                <span>{lenN === 1 ? "day" : "days"}, starting</span>
              </>
            )}
            {milestone && <span>Due</span>}
            <input type="number" min="-365" max="365" value={lag} onChange={(e) => setLag(e.target.value)} aria-label="Days after the last prerequisite"
              className="h-10 w-20 rounded-md border border-(--color-border) bg-(--color-surface) px-3 text-(--color-text-primary)" />
            <span>days after the last prerequisite is due</span>
          </div>
          <p className="rounded-md bg-(--color-surface-overlay) px-3 py-2 text-sm text-(--color-text-primary)">
            {start
              ? milestone
                ? <>Due <b>{show(start)}</b></>
                : <><b>{show(start)}</b> → due <b>{show(new Date(start.getTime() + lenN * DAY))}</b> · {lenN} day{lenN === 1 ? "" : "s"}</>
              : "Dates are set once a prerequisite has a due date."}
          </p>
          <input type="hidden" name="durationDays" value={lenN} />
          <input type="hidden" name="lagDays" value={lagN} />
        </>
      ) : (
        <div className="grid grid-cols-2 gap-4 [&>*]:min-w-0">
          <Field label="Start date" name="startDate" type="date" min={kickoffDate} max={endDate} defaultValue={toDateVal(initial?.startDate)} />
          <Field label="Due date" name="dueDate" type="date" min={kickoffDate} max={endDate} value={dueValue} onChange={(e) => setDue(e.target.value)} />
        </div>
      )}
      <input type="hidden" name="scheduleMode" value={auto ? "auto" : "dates"} />
    </div>
  );
}
