"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

const HOURS   = Array.from({ length: 12 }, (_, i) => i + 1); // 1–12
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5); // 00, 05, … 55

function parse(value: string | undefined): { h: number; m: number } {
  const [h, m] = (value ?? "").split(":").map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? { h, m } : { h: 15, m: 0 };
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Time picker in 5-minute steps: hour, minute and AM/PM. Phones' own time wheels ignore
 * step sizes, so this uses three small selects instead of <input type="time">.
 * Holds "HH:MM" (24-hour) like a time input — in a hidden input when given a name.
 */
export function TimeSelect({
  name, value, defaultValue, onChange, className, size = "md", "aria-label": ariaLabel, id,
}: {
  name?:         string;
  value?:        string;
  defaultValue?: string;
  onChange?:     (value: string) => void;
  className?:    string;
  size?:         "sm" | "md";
  "aria-label"?: string;
  id?:           string;
}) {
  const [own, setOwn] = useState(defaultValue ?? "15:00");
  const current = parse(value ?? own);
  const pm   = current.h >= 12;
  const hour = current.h % 12 || 12;
  // Keep an existing odd minute (e.g. 14:18) selectable rather than silently changing it
  const minutes = MINUTES.includes(current.m) ? MINUTES : [...MINUTES, current.m].sort((a, b) => a - b);

  function set(next: { hour?: number; minute?: number; pm?: boolean }) {
    const h12 = next.hour ?? hour;
    const isPm = next.pm ?? pm;
    const h24 = (h12 % 12) + (isPm ? 12 : 0);
    const v = `${pad(h24)}:${pad(next.minute ?? current.m)}`;
    if (value === undefined) setOwn(v);
    onChange?.(v);
  }

  const selectCls = cn(
    "rounded-md border border-(--color-border) bg-(--color-surface) text-(--color-text-primary) text-sm",
    "focus:border-(--color-primary) focus:outline-none",
    size === "sm" ? "h-9 px-1.5" : "h-11 px-2",
  );

  return (
    <div role="group" aria-label={ariaLabel} className={cn("inline-flex items-center gap-1", className)}>
      {name && <input type="hidden" name={name} value={`${pad(current.h)}:${pad(current.m)}`} />}
      <select id={id} aria-label="Hour" className={selectCls} value={hour} onChange={(e) => set({ hour: Number(e.target.value) })}>
        {HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
      </select>
      <span className="text-(--color-text-secondary)" aria-hidden>:</span>
      <select aria-label="Minute" className={selectCls} value={current.m} onChange={(e) => set({ minute: Number(e.target.value) })}>
        {minutes.map((m) => <option key={m} value={m}>{pad(m)}</option>)}
      </select>
      <select aria-label="AM or PM" className={selectCls} value={pm ? "PM" : "AM"} onChange={(e) => set({ pm: e.target.value === "PM" })}>
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  );
}
