"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const HOURS   = Array.from({ length: 12 }, (_, i) => i + 1); // 1–12
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5); // 00, 05, … 55

function parse(value: string | undefined): { h: number; m: number } {
  const [h, m] = (value ?? "").split(":").map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? { h, m } : { h: 15, m: 0 };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Whether this browser has a real time picker (<input type="time">) — phones and modern browsers do */
function supportsTimeInput(): boolean {
  const el = document.createElement("input");
  el.setAttribute("type", "time");
  el.value = "not-a-time";
  return el.type === "time" && el.value !== "not-a-time";
}

/**
 * A time field. Uses the device's own time picker (the iOS / Android wheel, the desktop
 * clock field), and falls back to hour / minute / AM-PM dropdowns in 5-minute steps only
 * where the browser has no time picker. Holds "HH:MM" (24-hour) — in a hidden input when
 * given a name, so forms submit it the same either way.
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
  // Native picker unless this browser turns out not to have one (checked after mount)
  const [native, setNative] = useState(true);
  useEffect(() => { if (!supportsTimeInput()) setNative(false); }, []);

  const current = parse(value ?? own);
  const hhmm = `${pad(current.h)}:${pad(current.m)}`;
  function emit(v: string) {
    if (value === undefined) setOwn(v);
    onChange?.(v);
  }

  const fieldCls = cn(
    "rounded-md border border-(--color-border) bg-(--color-surface) text-(--color-text-primary) text-sm",
    "focus:border-(--color-primary) focus:outline-none",
    size === "sm" ? "h-9" : "h-11",
  );

  if (native) {
    return (
      <span role="group" aria-label={ariaLabel} className={cn("inline-flex", className)}>
        {name && <input type="hidden" name={name} value={hhmm} />}
        <input id={id} type="time" step={300} aria-label={ariaLabel ?? "Time"} value={hhmm} required
          onChange={(e) => { if (e.target.value) emit(e.target.value.slice(0, 5)); }}
          className={cn(fieldCls, size === "sm" ? "px-2 min-w-[7.5rem]" : "px-3 min-w-[8.5rem]")} />
      </span>
    );
  }

  // Fallback: three small selects
  const pm   = current.h >= 12;
  const hour = current.h % 12 || 12;
  // Keep an existing odd minute (e.g. 14:18) selectable rather than silently changing it
  const minutes = MINUTES.includes(current.m) ? MINUTES : [...MINUTES, current.m].sort((a, b) => a - b);
  function set(next: { hour?: number; minute?: number; pm?: boolean }) {
    const h12 = next.hour ?? hour;
    const isPm = next.pm ?? pm;
    emit(`${pad((h12 % 12) + (isPm ? 12 : 0))}:${pad(next.minute ?? current.m)}`);
  }
  const selectCls = cn(fieldCls, size === "sm" ? "px-1.5" : "px-2");

  return (
    <div role="group" aria-label={ariaLabel} className={cn("inline-flex items-center gap-1", className)}>
      {name && <input type="hidden" name={name} value={hhmm} />}
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
