"use client";

import { useState } from "react";

/**
 * Which of the template's other tasks must be done first. Submitted as one
 * "prerequisiteNames" field ("|"-separated names). The task it's timed from (if any) is
 * added on save.
 */
export function PrerequisitePicker({ options, initial = [] }: { options: { name: string; isMilestone: boolean }[]; initial?: string[] }) {
  const [picked, setPicked] = useState<string[]>(initial);
  const [filter, setFilter] = useState("");
  const shown = options.filter((o) => !filter || o.name.toLowerCase().includes(filter.toLowerCase()));
  // Names that aren't in the template any more stay listed, so saving doesn't drop them silently
  const extra = picked.filter((p) => !options.some((o) => o.name === p));
  const toggle = (name: string) => setPicked((cur) => (cur.includes(name) ? cur.filter((n) => n !== name) : [...cur, name]));

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 mb-1.5">
        <span className="block text-sm font-medium text-(--color-text-primary)">
          Prerequisites {picked.length > 0 && <span className="font-normal text-(--color-text-secondary)">({picked.length})</span>}
        </span>
        {options.length > 8 && (
          <input type="search" placeholder="Filter…" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter tasks"
            className="h-8 w-40 rounded-md border border-(--color-border) bg-(--color-surface) px-2 text-sm text-(--color-text-primary)" />
        )}
      </div>
      {options.length === 0 && extra.length === 0
        ? <p className="text-small text-(--color-text-secondary)">No other tasks in this template yet.</p>
        : (
          <div className="max-h-40 overflow-y-auto rounded-md border border-(--color-border) p-2 space-y-0.5">
            {[...extra.map((name) => ({ name, isMilestone: false, missing: true })), ...shown.map((o) => ({ ...o, missing: false }))].map((o) => (
              <label key={o.name} className="flex items-center gap-2 rounded px-1.5 py-1 text-sm cursor-pointer hover:bg-(--color-surface-overlay)">
                <input type="checkbox" className="rounded" checked={picked.includes(o.name)} onChange={() => toggle(o.name)} />
                <span className={o.missing ? "text-(--color-text-secondary)" : "text-(--color-text-primary)"}>
                  {o.isMilestone ? "◆ " : ""}{o.name}{o.missing ? " (not in this template)" : ""}
                </span>
              </label>
            ))}
          </div>
        )}
      <p className="mt-1 text-small text-(--color-text-secondary)">Linked when the template is applied, so the team sees what has to be done first.</p>
      <input type="hidden" name="prerequisiteNames" value={picked.join("|")} />
    </div>
  );
}
