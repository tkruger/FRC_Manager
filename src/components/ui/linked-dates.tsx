"use client";

import { useEffect, useRef } from "react";

/**
 * Put inside a form with a start and an end date field: when the start date is picked and
 * the end is still empty, the end takes the same date — so its picker opens on the right
 * month and it's easy to move from there. Fields are found by name in the same form; works
 * for plain and React-controlled inputs (it sets the value the way typing would).
 */
export function LinkedDates({ start, end }: { start: string; end: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const form = ref.current?.closest("form");
    const from = form?.querySelector<HTMLInputElement>(`input[name="${start}"]`);
    const to = form?.querySelector<HTMLInputElement>(`input[name="${end}"]`);
    if (!from || !to) return;
    const follow = () => {
      if (!from.value || to.value || to.readOnly || to.disabled) return;
      // Through the native setter + events, so React state (if any) follows
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(to, from.value);
      to.dispatchEvent(new Event("input", { bubbles: true }));
      to.dispatchEvent(new Event("change", { bubbles: true }));
    };
    from.addEventListener("change", follow);
    return () => from.removeEventListener("change", follow);
  }, [start, end]);
  return <span ref={ref} hidden />;
}
