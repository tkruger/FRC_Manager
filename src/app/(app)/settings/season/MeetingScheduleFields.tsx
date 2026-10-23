"use client";

import { useState } from "react";
import { TimeSelect } from "@/components/ui/time-select";
import type { Slot } from "@/lib/meeting-schedule";

const DAYS = [
  { value: "MON", label: "Monday" },
  { value: "TUE", label: "Tuesday" },
  { value: "WED", label: "Wednesday" },
  { value: "THU", label: "Thursday" },
  { value: "FRI", label: "Friday" },
  { value: "SAT", label: "Saturday" },
  { value: "SUN", label: "Sunday" },
];

const WEEKDAY_SLOT: Slot = { start: "15:00", end: "20:00" };
const WEEKEND_SLOT: Slot = { start: "09:00", end: "17:00" };
const defaultSlot = (day: string) => (day === "SAT" || day === "SUN" ? WEEKEND_SLOT : WEEKDAY_SLOT);

let nextKey = 0;
type Row = Slot & { key: number };
const withKeys = (slots: Slot[]): Row[] => slots.map((s) => ({ ...s, key: nextKey++ }));

/**
 * Which days the team meets, and the meetings on each — a day can have several (e.g.
 * 3–5 pm and 6–8 pm). Submits meetingDays, and dayStart_<DAY> / dayEnd_<DAY> once per
 * meeting, in order.
 */
export function MeetingScheduleFields({ initialDays, initialSlots }: {
  initialDays: string[];
  /** Each day's meetings (defaults to one per selected day) */
  initialSlots?: Record<string, Slot[]>;
}) {
  const [days, setDays] = useState<string[]>(initialDays);
  const [slots, setSlots] = useState<Record<string, Row[]>>(() =>
    Object.fromEntries(DAYS.map(({ value }) => [value, withKeys(initialSlots?.[value]?.length ? initialSlots[value] : [defaultSlot(value)])])));

  const update = (day: string, key: number, patch: Partial<Slot>) =>
    setSlots((all) => ({ ...all, [day]: all[day].map((r) => (r.key === key ? { ...r, ...patch } : r)) }));
  const add = (day: string) =>
    setSlots((all) => {
      // A new meeting after the day's last one, two hours long
      const last = all[day][all[day].length - 1];
      const [h, m] = (last?.end ?? "18:00").split(":").map(Number);
      const start = `${String(Math.min(21, h)).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      const end = `${String(Math.min(23, h + 2)).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      return { ...all, [day]: [...all[day], ...withKeys([{ start, end }])] };
    });
  const remove = (day: string, key: number) => setSlots((all) => ({ ...all, [day]: all[day].filter((r) => r.key !== key) }));

  return (
    <div>
      <p className="block text-sm font-medium text-(--color-text-primary) mb-1">
        Build meeting days &amp; times <span className="text-(--color-danger)">*</span>
      </p>
      <p className="text-small text-(--color-text-secondary) mb-3">
        Pick the days the team meets and each meeting&apos;s times. Use <b>+ another time</b> for more than one meeting on a day.
      </p>
      <div className="rounded-md border border-(--color-border) overflow-hidden divide-y divide-(--color-border)/40">
        {DAYS.map(({ value, label }) => {
          const checked = days.includes(value);
          const rows = slots[value];
          return (
            <div key={value} className={`flex flex-wrap items-start gap-x-3 gap-y-2 px-3 py-3 transition-colors ${checked ? "bg-(--color-primary)/8" : "hover:bg-(--color-surface-overlay)"}`}>
              <label className="flex items-center gap-3 cursor-pointer flex-shrink-0 min-w-[140px] min-h-9">
                <input type="checkbox" name="meetingDays" value={value} checked={checked} className="rounded flex-shrink-0"
                  onChange={(e) => setDays((prev) => (e.target.checked ? [...prev, value] : prev.filter((d) => d !== value)))} />
                <span className="text-sm text-(--color-text-primary)">{label}</span>
              </label>
              {checked && (
                <div className="flex flex-col gap-2 sm:ml-auto sm:items-end">
                  {rows.map((r, i) => (
                    <div key={r.key} className="flex flex-wrap items-center gap-2">
                      <TimeSelect size="sm" name={`dayStart_${value}`} value={r.start} onChange={(v) => update(value, r.key, { start: v })} aria-label={`${label} meeting ${i + 1} start`} />
                      <span className="text-small text-(--color-text-secondary)">to</span>
                      <TimeSelect size="sm" name={`dayEnd_${value}`} value={r.end} onChange={(v) => update(value, r.key, { end: v })} aria-label={`${label} meeting ${i + 1} end`} />
                      {rows.length > 1 && (
                        <button type="button" onClick={() => remove(value, r.key)} aria-label={`Remove ${label} meeting ${i + 1}`}
                          className="h-9 w-9 rounded-md text-(--color-text-secondary) hover:bg-(--color-surface-overlay) hover:text-(--color-danger)">×</button>
                      )}
                    </div>
                  ))}
                  <button type="button" onClick={() => add(value)} className="text-small text-(--color-secondary) hover:underline self-start sm:self-end">
                    + another time
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
