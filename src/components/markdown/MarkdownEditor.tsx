"use client";

import { useRef, useState } from "react";
import { Markdown } from "./Markdown";

type Edit = { before: string; after?: string; placeholder?: string; line?: boolean };

// What each toolbar button does: wrap the selection, or prefix each selected line
const TOOLS: { key: string; label: React.ReactNode; title: string; edit: Edit }[] = [
  { key: "b",     label: <b>B</b>,         title: "Bold (Ctrl+B)",   edit: { before: "**", after: "**", placeholder: "bold text" } },
  { key: "i",     label: <i>I</i>,         title: "Italic (Ctrl+I)", edit: { before: "_", after: "_", placeholder: "italic text" } },
  { key: "h",     label: "H",              title: "Heading",         edit: { before: "### ", line: true } },
  { key: "ul",    label: "•",              title: "Bulleted list",   edit: { before: "- ", line: true } },
  { key: "ol",    label: "1.",             title: "Numbered list",   edit: { before: "1. ", line: true } },
  { key: "check", label: "☐",              title: "Checklist",       edit: { before: "- [ ] ", line: true } },
  { key: "link",  label: "🔗",             title: "Link (Ctrl+K)",   edit: { before: "[", after: "](https://)", placeholder: "link text" } },
  { key: "code",  label: <code>{"</>"}</code>, title: "Code",        edit: { before: "`", after: "`", placeholder: "code" } },
  { key: "quote", label: "❝",              title: "Quote",           edit: { before: "> ", line: true } },
];

/**
 * A Markdown text box with formatting buttons and a preview. Submits as an ordinary form
 * field (`name`), so it drops into any form.
 */
export function MarkdownEditor({ name, label = "Details", defaultValue = "", rows = 8, hint, maxLength = 20000 }: {
  name: string;
  label?: string;
  defaultValue?: string;
  rows?: number;
  hint?: string;
  maxLength?: number;
}) {
  const [value, setValue] = useState(defaultValue);
  const [preview, setPreview] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  function apply({ before, after = "", placeholder = "", line }: Edit) {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    let next: string, selStart: number, selEnd: number;
    if (line) {
      // Prefix every selected line (or the current line)
      const lineStart = value.lastIndexOf("\n", s - 1) + 1;
      const block = value.slice(lineStart, e);
      const prefixed = block.split("\n").map((l, i) => (before === "1. " ? `${i + 1}. ` : before) + l).join("\n");
      next = value.slice(0, lineStart) + prefixed + value.slice(e);
      selStart = lineStart; selEnd = lineStart + prefixed.length;
    } else {
      const picked = value.slice(s, e) || placeholder;
      next = value.slice(0, s) + before + picked + after + value.slice(e);
      selStart = s + before.length; selEnd = selStart + picked.length;
    }
    setValue(next);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(selStart, selEnd); });
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.ctrlKey || e.metaKey) {
      const tool = { b: "b", i: "i", k: "link" }[e.key.toLowerCase()];
      if (tool) { e.preventDefault(); apply(TOOLS.find((t) => t.key === tool)!.edit); return; }
    }
    // Enter inside a list continues it (an empty item ends the list)
    if (e.key === "Enter" && !e.shiftKey) {
      const el = e.currentTarget;
      const s = el.selectionStart;
      const lineStart = value.lastIndexOf("\n", s - 1) + 1;
      const current = value.slice(lineStart, s);
      const m = current.match(/^(\s*)(- \[[ x]\] |- |\* |(\d+)\. )(.*)$/);
      if (!m) return;
      e.preventDefault();
      if (!m[4].trim()) {
        const next = value.slice(0, lineStart) + value.slice(s);
        setValue(next);
        requestAnimationFrame(() => el.setSelectionRange(lineStart, lineStart));
        return;
      }
      const marker = m[3] ? `${Number(m[3]) + 1}. ` : m[2].startsWith("- [") ? "- [ ] " : m[2];
      const insert = `\n${m[1]}${marker}`;
      const next = value.slice(0, s) + insert + value.slice(el.selectionEnd);
      setValue(next);
      requestAnimationFrame(() => el.setSelectionRange(s + insert.length, s + insert.length));
    }
  }

  const tab = (on: boolean) =>
    `px-2.5 py-1 rounded text-xs font-medium ${on ? "bg-(--color-surface) text-(--color-text-primary) shadow-sm" : "text-(--color-text-secondary) hover:text-(--color-text-primary)"}`;

  return (
    <div className="space-y-1.5">
      <div className="flex items-end justify-between gap-2">
        <label className="block text-sm font-medium text-(--color-text-primary)" htmlFor={`md-${name}`}>{label}</label>
        <div className="flex rounded-md bg-(--color-surface-overlay) p-0.5" role="tablist">
          <button type="button" role="tab" aria-selected={!preview} className={tab(!preview)} onClick={() => setPreview(false)}>Write</button>
          <button type="button" role="tab" aria-selected={preview} className={tab(preview)} onClick={() => setPreview(true)}>Preview</button>
        </div>
      </div>
      <div className="rounded-md border border-(--color-border) bg-(--color-surface) focus-within:border-(--color-primary) focus-within:ring-2 focus-within:ring-(--color-primary)/20">
        {!preview && (
          <div className="flex flex-wrap gap-0.5 border-b border-(--color-border) px-1.5 py-1">
            {TOOLS.map((t) => (
              <button key={t.key} type="button" title={t.title} aria-label={t.title} onClick={() => apply(t.edit)}
                className="min-w-8 h-8 px-1.5 rounded text-sm text-(--color-text-secondary) hover:bg-(--color-surface-overlay) hover:text-(--color-text-primary)">
                {t.label}
              </button>
            ))}
          </div>
        )}
        {/* The textarea stays in the form while previewing, so the value is always submitted */}
        <textarea
          ref={ref}
          id={`md-${name}`}
          name={name}
          rows={rows}
          maxLength={maxLength}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Steps, links, checklists… Markdown works: **bold**, _italic_, - lists, - [ ] checklists"
          className={`w-full resize-y bg-transparent px-3 py-2 text-sm text-(--color-text-primary) placeholder:text-(--color-text-disabled) focus:outline-none ${preview ? "hidden" : ""}`}
        />
        {preview && (
          <div className="px-3 py-2 min-h-24">
            {value.trim() ? <Markdown>{value}</Markdown> : <p className="text-sm text-(--color-text-disabled)">Nothing to preview yet.</p>}
          </div>
        )}
      </div>
      {hint && <p className="text-small text-(--color-text-secondary)">{hint}</p>}
    </div>
  );
}
