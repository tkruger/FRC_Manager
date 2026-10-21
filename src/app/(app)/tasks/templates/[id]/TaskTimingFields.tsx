"use client";

import { useState } from "react";
import {
  ANCHOR_OPTIONS, STAGE_INFO, anchorName, isCompetitionAnchor, legacyAnchor, resolveAnchor,
  type TaskAnchor, type CompetitionStage,
} from "@/lib/competition";

/** The active season's dates, for showing real dates while you edit (ISO strings) */
export interface SeasonPreview {
  name:         string;
  kickoffDate:  string;
  endDate:      string;
  competitions: { name: string; stage: CompetitionStage; stageNumber: number | null; startDate: string }[];
}

/** Another task in the template a task can be timed from, with its due date in the active season (ISO) */
export interface TaskOption {
  name: string;
  isMilestone: boolean;
  due: string | null;
}

type Direction = "before" | "on" | "after";

const inputCls =
  "h-11 rounded-md border border-(--color-border) bg-(--color-surface) text-(--color-text-primary) px-3 text-sm focus:border-(--color-primary) focus:outline-none focus:ring-2 focus:ring-(--color-primary)/20";
const labelCls = "block text-sm font-medium text-(--color-text-primary) mb-1.5";

const DAY = 86_400_000;
/** Calendar dates are stored at UTC midnight — add whole days and show them in UTC */
const plusDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY);
const show = (d: Date) => d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
const days = (n: number) => `${n} day${n === 1 ? "" : "s"}`;

function relative(n: number, what: string) {
  return n === 0 ? `on ${what}` : `${days(Math.abs(n))} ${n < 0 ? "before" : "after"} ${what}`;
}

/**
 * When a template task is due, and (for tasks) how long it takes.
 *
 * Stored as before — startOffset (start, relative to the anchor) and durationBuildDays — so
 * templates, CSVs and applying are unchanged: due = start + length. People think in due
 * dates, so that's what the form asks for; milestones are just a due date (length 0).
 */
export function TaskTimingFields({ initial, season, tasks = [] }: {
  initial?: { anchor: TaskAnchor | null; anchorNumber: number | null; anchorTaskName?: string | null; startOffset: number; durationBuildDays: number; isMilestone: boolean };
  season:   SeasonPreview | null;
  /** The template's other tasks, for "after another task" */
  tasks?:   TaskOption[];
}) {
  // New tasks start as "due 7 days after kickoff, takes 3 days"
  const startOffset = initial?.startOffset ?? 4;
  const length0     = initial ? initial.durationBuildDays : 3;
  const due0        = startOffset + length0;

  const [milestone, setMilestone] = useState(initial?.isMilestone ?? false);
  const [anchor, setAnchor]       = useState<TaskAnchor>(initial?.anchor ?? legacyAnchor(startOffset));
  const [number, setNumber]       = useState(initial?.anchorNumber != null ? String(initial.anchorNumber) : "");
  const [direction, setDirection] = useState<Direction>(due0 < 0 ? "before" : due0 > 0 ? "after" : "on");
  const [count, setCount]         = useState(String(Math.abs(due0) || ""));
  const [length, setLength]       = useState(String(Math.max(1, length0)));
  const [after, setAfter]         = useState(initial?.anchorTaskName ?? "");

  const numbered = isCompetitionAnchor(anchor) && STAGE_INFO[anchor].numbered;
  const n        = numbered && number !== "" ? Number(number) : null;
  const byTask   = anchor === "TASK";
  const what     = anchorName(anchor, n, after || null) + (byTask ? " is due" : "");
  const afterTask = byTask ? tasks.find((t) => t.name === after) : undefined;

  // What gets saved
  const dueOffset = direction === "on" ? 0 : (direction === "before" ? -1 : 1) * Math.max(0, Math.round(Number(count) || 0));
  const len       = milestone ? 0 : Math.max(1, Math.round(Number(length) || 1));
  const start     = dueOffset - len;

  // This season's dates for the first match, if the season has one (for a task timed from
  // a task: that task's due date)
  const target = byTask
    ? (afterTask?.due ? [{ date: new Date(afterTask.due), suffix: null }] : [])
    : season
    ? resolveAnchor(anchor, n, {
        kickoffDate:  new Date(season.kickoffDate),
        endDate:      new Date(season.endDate),
        competitions: season.competitions.map((c) => ({ ...c, startDate: new Date(c.startDate) })),
      })
    : [];
  const first = target[0];

  return (
    <div className="space-y-4">
      {/* Task or milestone */}
      <div>
        <span className={labelCls}>Type</span>
        <div className="inline-flex rounded-md bg-(--color-surface-overlay) p-1" role="radiogroup" aria-label="Type">
          {([["task", "Task"], ["milestone", "Milestone ◆"]] as const).map(([k, label]) => {
            const on = (k === "milestone") === milestone;
            return (
              <button key={k} type="button" role="radio" aria-checked={on} onClick={() => setMilestone(k === "milestone")}
                className={`rounded px-3 py-1.5 text-sm font-medium ${on ? "bg-(--color-surface) text-(--color-text-primary) shadow-sm" : "text-(--color-text-secondary)"}`}>
                {label}
              </button>
            );
          })}
        </div>
        <p className="mt-1 text-small text-(--color-text-secondary)">
          {milestone ? "A checkpoint with a date — no work length." : "Work that takes some days and is due by a date."}
        </p>
      </div>

      {/* Due date, relative to an anchor */}
      <div>
        <span className={labelCls}>Due</span>
        {/* Reads as a sentence: [3] days [before] [Week 0] */}
        <div className="flex flex-wrap items-center gap-2">
          {direction !== "on" && (
            <>
              <input className={`${inputCls} w-20`} type="number" min="1" max="365" required aria-label="Number of days" value={count}
                onChange={(e) => setCount(e.target.value)} />
              <span className="text-sm text-(--color-text-secondary)">{Number(count) === 1 ? "day" : "days"}</span>
            </>
          )}
          <select className={`${inputCls} w-28`} aria-label="Before, on or after" value={direction} onChange={(e) => setDirection(e.target.value as Direction)}>
            <option value="before">before</option>
            <option value="on">on</option>
            <option value="after">after</option>
          </select>
          <select className={`${inputCls} min-w-0 flex-1 basis-56`} aria-label="Relative to" value={anchor} onChange={(e) => setAnchor(e.target.value as TaskAnchor)}>
            {ANCHOR_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            {(tasks.length > 0 || byTask) && <option value="TASK">Another task in this template…</option>}
          </select>
        </div>
        {byTask && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <select className={`${inputCls} min-w-0 flex-1 basis-64`} aria-label="Which task" required value={after} onChange={(e) => setAfter(e.target.value)}>
              <option value="" disabled>Pick the task it follows…</option>
              {after && !tasks.some((t) => t.name === after) && <option value={after}>{after} (not in this template)</option>}
              {tasks.map((t) => <option key={t.name} value={t.name}>{t.isMilestone ? "◆ " : ""}{t.name}</option>)}
            </select>
            <span className="text-sm text-(--color-text-secondary)">is due</span>
            <p className="basis-full text-small text-(--color-text-secondary)">
              Moves with that task, and it&apos;s added as a prerequisite. If it happens at every competition, this does too.
            </p>
          </div>
        )}
        {numbered && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <label className="text-sm text-(--color-text-secondary)" htmlFor="anchor-number">Which one</label>
            <input id="anchor-number" className={`${inputCls} w-24`} type="number" min="0" max="99" placeholder="Each" value={number}
              onChange={(e) => setNumber(e.target.value)} />
            <span className="text-small text-(--color-text-secondary)">
              {number === "" ? `Blank = one ${milestone ? "milestone" : "task"} for every ${STAGE_INFO[anchor as CompetitionStage].label.toLowerCase()}, named after it (e.g. “… — Week1”)` : `${STAGE_INFO[anchor as CompetitionStage].prefix}${number} only`}
            </span>
          </div>
        )}
      </div>

      {/* Length (tasks only) */}
      {!milestone && (
        <div className="max-w-[12rem]">
          <label className={labelCls} htmlFor="task-length">Takes</label>
          <div className="flex items-center gap-2">
            <input id="task-length" className={`${inputCls} w-20`} type="number" min="1" max="365" required value={length}
              onChange={(e) => setLength(e.target.value)} />
            <span className="text-sm text-(--color-text-secondary)">days</span>
          </div>
        </div>
      )}

      {/* Plain-language summary with this season's real dates */}
      <div className="rounded-md bg-(--color-surface-overlay) px-3 py-2.5 text-sm space-y-0.5">
        {milestone ? (
          <p className="text-(--color-text-primary)">◆ Due <b>{relative(dueOffset, what)}</b>.</p>
        ) : (
          <p className="text-(--color-text-primary)">
            Starts <b>{relative(start, what)}</b> and is due <b>{relative(dueOffset, what)}</b> — {days(len)} of work.
          </p>
        )}
        {season && first && (
          <p className="text-(--color-text-secondary)">
            {season.name}{target.length > 1 && first.suffix ? ` (${first.suffix})` : ""}:{" "}
            {milestone
              ? <>due {show(plusDays(first.date, dueOffset))}</>
              : <>{show(plusDays(first.date, start))} → due {show(plusDays(first.date, dueOffset))}</>}
            {target.length > 1 && ` — and ${target.length - 1} more`}
          </p>
        )}
        {season && !first && byTask && (
          <p className="text-(--color-text-secondary)">
            {after ? `Dated from “${after}” when the template is applied.` : "Pick the task this one follows."}
          </p>
        )}
        {season && !first && !byTask && (
          <p className="text-(--color-warning)">
            {season.name} has no {isCompetitionAnchor(anchor) ? `${n != null ? `${STAGE_INFO[anchor].prefix}${n}` : STAGE_INFO[anchor].label.toLowerCase()}` : "Week 0"} yet, so this would be skipped when the template is applied.
          </p>
        )}
      </div>

      {/* Saved the same way as always */}
      <input type="hidden" name="anchor" value={anchor} />
      <input type="hidden" name="anchorNumber" value={numbered ? number : ""} />
      <input type="hidden" name="anchorTaskName" value={byTask ? after : ""} />
      <input type="hidden" name="startOffset" value={start} />
      <input type="hidden" name="durationBuildDays" value={len} />
      {milestone && <input type="hidden" name="isMilestone" value="on" />}
    </div>
  );
}
