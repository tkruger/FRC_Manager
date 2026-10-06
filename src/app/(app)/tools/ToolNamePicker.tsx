"use client";

import { useState } from "react";

const NEW = "__new__";

const inputCls =
  "h-11 w-full rounded-md border border-(--color-border) bg-(--color-surface) px-3 text-sm text-(--color-text-primary) focus:border-(--color-primary) focus:outline-none";

/**
 * A tool's name is also its group: tools with the same name share a card. Pick an existing
 * name from the list, or "+ New name…" to type one (it then appears in the list next time).
 * With no tools yet it's just a text box. Submits as `name`.
 */
export function ToolNamePicker({
  names, defaultValue = "", onChange,
}: {
  /** Existing tool names (groups) */
  names:         string[];
  defaultValue?: string;
  onChange?:     (name: string) => void;
}) {
  // The list's spelling of the current name (grouping ignores capitalization)
  const known = names.find((n) => n.toLowerCase() === defaultValue.trim().toLowerCase());
  const [choice, setChoice] = useState(names.length === 0 || (defaultValue && !known) ? NEW : known ?? "");
  const [typed, setTyped]   = useState(known ? "" : defaultValue);
  const value = choice === NEW ? typed : choice;

  function pick(next: string) {
    setChoice(next);
    onChange?.(next === NEW ? typed : next);
  }

  return (
    <div className="space-y-2">
      <label htmlFor="tool-name" className="block text-sm font-medium text-(--color-text-primary)">
        Tool name <span className="text-(--color-danger)" aria-hidden>*</span>
      </label>
      <input type="hidden" name="name" value={value} />

      {names.length > 0 && (
        <select
          id={choice === NEW ? undefined : "tool-name"}
          className={inputCls}
          value={choice}
          required={choice !== NEW}
          onChange={(e) => pick(e.target.value)}
        >
          <option value="" disabled>Choose a tool…</option>
          {names.map((n) => <option key={n} value={n}>{n}</option>)}
          <option value={NEW}>+ New name…</option>
        </select>
      )}

      {choice === NEW && (
        <input
          id="tool-name"
          className={inputCls}
          required
          maxLength={120}
          autoFocus={names.length > 0}
          value={typed}
          onChange={(e) => { setTyped(e.target.value); onChange?.(e.target.value); }}
          placeholder="e.g. Cordless Drill — DeWalt 20V"
        />
      )}
      <p className="text-small text-(--color-text-secondary)">
        Tools with the same name are grouped together{names.length > 0 ? " — pick one to add another of the same tool." : "."}
      </p>
    </div>
  );
}
