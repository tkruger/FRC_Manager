// Lays a template out on one timeline (days from kickoff) for the presentation view.
// Client-safe: no database access.
//
// Real dates come from the active season. Anything the season can't place yet (no Week 0,
// no matching competition, or no active season at all) gets a typical-season estimate and
// is marked `estimated`, so the deck can still show the whole plan.

import {
  STAGE_INFO, anchorName, designation, isCompetitionAnchor, resolveAnchor, week0Date,
  type CompetitionStage, type TaskAnchor,
} from "@/lib/competition";

export interface TimelineTask {
  id: string;
  name: string;
  subTeam: string | null;
  priority: string;
  isMilestone: boolean;
  anchor: TaskAnchor;
  anchorNumber: number | null;
  /** With anchor TASK: the template task (by name) this one counts from */
  anchorTaskName: string | null;
  startOffset: number;
  durationBuildDays: number;
  estimatedHours: number | null;
  designReviewRequired: boolean;
  prerequisiteNames: string[];
}

// ── Scheduling: events first, then tasks timed from other tasks ─────────────

/** What placing a template task needs */
export interface ScheduleTask {
  name: string;
  anchor: TaskAnchor;
  anchorNumber: number | null;
  anchorTaskName?: string | null;
  startOffset: number;
  durationBuildDays: number;
}

/** Where an event-anchored task lands (days from kickoff); none = the season can't place it */
export interface EventTarget {
  day: number;
  suffix: string | null;
  estimated: boolean;
  /** Placed by estimate because the season has no such event (it'd be skipped when applied) */
  missing?: boolean;
}

export interface Placement<T> {
  task: T;
  /** "Week1" when the task repeats per competition — inherited by tasks timed from it */
  suffix: string | null;
  /** Days from kickoff */
  start: number;
  due: number;
  estimated: boolean;
  missing: boolean;
  /** The event the chain starts from (a TASK-timed task takes its target's) */
  root: TaskAnchor;
}

export type UnplacedReason = "no-event" | "missing-task" | "loop" | "after-unplaced";

const nameKey = (n: string) => n.trim().toLowerCase();

/**
 * Places template tasks on one timeline (days from kickoff). Event anchors come from
 * `eventTargets`; a TASK-anchored task counts from the due date of the named task in the
 * same template, once for each time that task happens (same suffix — "Adjust strategy"
 * follows each "Event"). Tasks that can't be placed come back in `unplaced` with why:
 * no such event, the task they follow isn't in the template, they follow each other in a
 * loop, or the task they follow couldn't be placed.
 */
export function scheduleTemplate<T extends ScheduleTask>(
  tasks: T[],
  eventTargets: (t: T) => EventTarget[],
): { placed: Placement<T>[]; unplaced: { task: T; reason: UnplacedReason }[] } {
  const byName = new Map<string, T>();
  for (const t of tasks) if (!byName.has(nameKey(t.name))) byName.set(nameKey(t.name), t);

  const done = new Map<T, Placement<T>[] | UnplacedReason>();
  const place = (t: T, targets: (EventTarget & { root: TaskAnchor })[]) =>
    done.set(t, targets.map((x) => ({
      task: t, suffix: x.suffix, estimated: x.estimated, missing: !!x.missing, root: x.root,
      start: x.day + t.startOffset, due: x.day + t.startOffset + t.durationBuildDays,
    })));

  for (const t of tasks) {
    if (t.anchor === "TASK") continue;
    const targets = eventTargets(t);
    if (targets.length) place(t, targets.map((x) => ({ ...x, root: t.anchor })));
    else done.set(t, "no-event");
  }

  // Tasks timed from tasks: keep going while something new can be placed
  let pending = tasks.filter((t) => t.anchor === "TASK");
  for (let progress = true; progress && pending.length; ) {
    progress = false;
    pending = pending.filter((t) => {
      const target = t.anchorTaskName ? byName.get(nameKey(t.anchorTaskName)) : undefined;
      if (!target) { done.set(t, "missing-task"); progress = true; return false; }
      if (target === t) { done.set(t, "loop"); progress = true; return false; }
      const at = done.get(target);
      if (at === undefined) return true; // not placed yet
      if (typeof at === "string") { done.set(t, "after-unplaced"); progress = true; return false; }
      place(t, at.map((p) => ({ day: p.due, suffix: p.suffix, estimated: p.estimated, missing: p.missing, root: p.root })));
      progress = true;
      return false;
    });
  }
  for (const t of pending) done.set(t, "loop");

  const placed: Placement<T>[] = [];
  const unplaced: { task: T; reason: UnplacedReason }[] = [];
  for (const t of tasks) {
    const r = done.get(t)!;
    if (typeof r === "string") unplaced.push({ task: t, reason: r });
    else placed.push(...r);
  }
  return { placed, unplaced };
}

/**
 * Template tasks that would follow each other in a loop if `name` were timed from
 * `targetName` (directly or through others) — used to refuse such an edit.
 */
export function wouldLoop(tasks: { name: string; anchor: TaskAnchor; anchorTaskName?: string | null }[], name: string, targetName: string): boolean {
  const byName = new Map(tasks.map((t) => [nameKey(t.name), t]));
  const seen = new Set<string>();
  for (let cur = nameKey(targetName); cur; ) {
    if (cur === nameKey(name)) return true;
    if (seen.has(cur)) return false;
    seen.add(cur);
    const t = byName.get(cur);
    cur = t?.anchor === "TASK" && t.anchorTaskName ? nameKey(t.anchorTaskName) : "";
  }
  return false;
}

export interface TimelineSeason {
  name: string;
  /** An example season for showing the template, not the team's real one */
  illustrative?: boolean;
  kickoffDate: string;
  endDate: string;
  competitions: { name: string; stage: CompetitionStage; stageNumber: number | null; startDate: string }[];
}

/**
 * The example season the presentation is drawn on (for illustration — real seasons differ):
 * kickoff on the second Sunday of next year, Week 2 and Week 4 events, district playoffs
 * in Week 6, Worlds on the third Saturday of April, and the season ending a week after Worlds.
 * Competitions are Saturday–Sunday, so each is dated on its Saturday; FRC's Week 1 is
 * about 7 weeks after kickoff.
 */
export function illustrativeSeason(today = new Date()): TimelineSeason {
  const year = today.getUTCFullYear() + 1;
  const utc = (m: number, d: number) => new Date(Date.UTC(year, m, d));
  const plus = (d: Date, n: number) => new Date(d.getTime() + n * DAY);
  const SUN = 0, SAT = 6;
  const jan1 = utc(0, 1);
  const kickoff = plus(jan1, (SUN - jan1.getUTCDay() + 7) % 7 + 7);       // second Sunday of the year
  const week = (n: number) => plus(kickoff, 48 + 7 * (n - 1));             // Saturday of FRC week n
  const apr1 = utc(3, 1);
  const worlds = plus(apr1, ((SAT - apr1.getUTCDay() + 7) % 7) + 14);      // third Saturday of April
  const iso = (d: Date) => d.toISOString();
  return {
    name: `Example ${year} season`,
    illustrative: true,
    kickoffDate: iso(kickoff),
    endDate: iso(plus(worlds, 7)),
    competitions: [
      { name: "Week 2 event", stage: "WEEK", stageNumber: 2, startDate: iso(week(2)) },
      { name: "Week 4 event", stage: "WEEK", stageNumber: 4, startDate: iso(week(4)) },
      { name: "District playoffs", stage: "PLAYOFF", stageNumber: 1, startDate: iso(week(6)) },
      { name: "Worlds", stage: "WORLDS", stageNumber: null, startDate: iso(worlds) },
    ],
  };
}

export interface TimelineItem {
  key: string;
  taskId: string;
  name: string;
  /** "Week1" when one template task becomes one per competition */
  suffix: string | null;
  subTeam: string | null;
  priority: string;
  isMilestone: boolean;
  /** Days from kickoff */
  start: number;
  due: number;
  /** Placed by estimate, not a real season date */
  estimated: boolean;
  anchor: TaskAnchor;
  /** "3 days before Week 0" */
  rule: string;
  hours: number | null;
  designReview: boolean;
}

export interface TimelineMarker {
  day: number;
  label: string;
  kind: "kickoff" | "week0" | "competition" | "end";
  estimated: boolean;
}

export interface Timeline {
  items: TimelineItem[];
  markers: TimelineMarker[];
  /** Kickoff as an ISO date when there's an active season (for real date labels) */
  kickoff: string | null;
  seasonName: string | null;
  illustrative: boolean;
  /** Template tasks the active season can't place (they'd be skipped when applied) */
  skipped: string[];
  /** Tasks timed from a task that isn't in the template, or in a loop (shown at kickoff) */
  broken: { name: string; reason: UnplacedReason }[];
}

const DAY = 86_400_000;
const days = (n: number) => `${Math.abs(n)} day${Math.abs(n) === 1 ? "" : "s"}`;

/** A typical season, for anchors the real season doesn't have (days from kickoff) */
function estimateDay(anchor: TaskAnchor, n: number | null, week0: number, end: number): number {
  switch (anchor) {
    case "KICKOFF":      return 0;
    case "SEASON_WEEK0": return week0;
    case "SEASON_END":   return end;
    case "PRACTICE":     return week0 - 10 + 3 * (n ?? 1);
    case "WEEK":         return week0 + 7 * (n ?? 1);
    case "PLAYOFF":      return week0 + 49 + 7 * (n ?? 0);
    case "WORLDS":       return week0 + 63;
    case "OFFSEASON":    return end + 21 + 21 * Math.max(0, (n ?? 1) - 1);
    case "TASK":         return 0; // placed from its task by scheduleTemplate
  }
}

/** "3 days before Week 0", "on kickoff", "2 days after “Robot design locked” is due" */
export function ruleText(anchor: TaskAnchor, anchorNumber: number | null, offset: number, taskName?: string | null): string {
  const what = anchorName(anchor, anchorNumber, taskName) + (anchor === "TASK" ? " is due" : "");
  return offset === 0 ? `${anchor === "TASK" ? "when" : "on"} ${what}` : `${days(offset)} ${offset < 0 ? "before" : "after"} ${what}`;
}

export function buildTimeline(tasks: TimelineTask[], season: TimelineSeason | null): Timeline {
  const kickoff = season ? new Date(season.kickoffDate) : null;
  const dayOf = (d: Date) => (kickoff ? Math.round((d.getTime() - kickoff.getTime()) / DAY) : 0);
  const dates = season && {
    kickoffDate:  new Date(season.kickoffDate),
    endDate:      new Date(season.endDate),
    competitions: season.competitions.map((c) => ({ ...c, startDate: new Date(c.startDate) })),
  };

  // Week 0 always has a date: the season's Week0 event, else the week before Week 1 (worked
  // out from its Week events, else the typical FRC schedule) — see week0Date
  const w0 = dates ? week0Date(dates) : null;
  const week0 = w0 ? dayOf(w0.date) : 42; // ~6 weeks of build, then Week 1
  const week0Estimated = !w0 || w0.source === "estimate";
  const end   = dates ? dayOf(dates.endDate) : 120;

  // Every event-anchored task gets a place: the season's date, else a typical-season estimate
  const { placed, unplaced } = scheduleTemplate(tasks, (t): EventTarget[] => {
    const real = dates
      ? resolveAnchor(t.anchor, t.anchorNumber, dates).map((r) => ({ day: dayOf(r.date), suffix: r.suffix, estimated: t.anchor === "SEASON_WEEK0" && week0Estimated }))
      : [];
    if (real.length) return real;
    const each = isCompetitionAnchor(t.anchor) && STAGE_INFO[t.anchor].numbered && t.anchorNumber == null;
    return [{ day: estimateDay(t.anchor, t.anchorNumber, week0, end), suffix: each ? `each ${STAGE_INFO[t.anchor as CompetitionStage].label.toLowerCase()}` : null, estimated: true, missing: !!season }];
  });
  // Tasks timed from a task that isn't there (or in a loop) still show, at kickoff
  const all: Placement<TimelineTask>[] = [
    ...placed,
    ...unplaced.map(({ task: t }) => ({ task: t, suffix: null, start: t.startOffset, due: t.startOffset + t.durationBuildDays, estimated: true, missing: true, root: "KICKOFF" as TaskAnchor })),
  ];

  const items: TimelineItem[] = [];
  const skipped: string[] = [];
  const count = new Map<string, number>();
  for (const p of all) {
    const t = p.task;
    if (p.missing && season) skipped.push(t.name);
    const i = count.get(t.id) ?? 0;
    count.set(t.id, i + 1);
    items.push({
      key: `${t.id}-${i}`, taskId: t.id, name: t.name, suffix: p.suffix,
      subTeam: t.subTeam, priority: t.priority, isMilestone: t.isMilestone,
      start: p.start, due: p.due,
      estimated: p.estimated, anchor: p.root, rule: ruleText(t.anchor, t.anchorNumber, t.startOffset + t.durationBuildDays, t.anchorTaskName),
      hours: t.estimatedHours, designReview: t.designReviewRequired,
    });
  }
  // Order of execution: tasks by when they start, milestones by when they're due (older
  // milestones can carry a length, and their start isn't when they happen)
  const when = (i: TimelineItem) => (i.isMilestone ? i.due : i.start);
  items.sort((a, b) => when(a) - when(b) || a.due - b.due || a.name.localeCompare(b.name));

  // Reference lines: kickoff, Week 0, the season's competitions and its end
  const markers: TimelineMarker[] = [{ day: 0, label: "Kickoff", kind: "kickoff", estimated: !season }];
  if (dates) {
    for (const c of dates.competitions) {
      const isWeek0 = c.stage === "WEEK" && c.stageNumber === 0;
      markers.push({ day: dayOf(c.startDate), label: isWeek0 ? "Week 0" : designation(c.stage, c.stageNumber), kind: isWeek0 ? "week0" : "competition", estimated: false });
    }
    markers.push({ day: end, label: "Season end", kind: "end", estimated: false });
  }
  // Week 0 without its own event: a line the week before Week 1
  if (w0?.source !== "event") {
    markers.push({ day: week0, label: week0Estimated ? "Week 0 (est.)" : "Week 0", kind: "week0", estimated: week0Estimated });
  }
  if (!season && items.some((i) => i.anchor === "SEASON_END" || i.anchor === "OFFSEASON")) {
    markers.push({ day: end, label: "Season end (est.)", kind: "end", estimated: true });
  }
  markers.sort((a, b) => a.day - b.day);

  return {
    items, markers, kickoff: season?.kickoffDate ?? null, seasonName: season?.name ?? null, illustrative: !!season?.illustrative,
    skipped: [...new Set(skipped)],
    broken: unplaced.map((u) => ({ name: u.task.name, reason: u.reason })),
  };
}

/** Which part of the season a task belongs to (one slide per phase) */
export const PHASES: { key: string; title: string; subtitle: string; anchors: TaskAnchor[] }[] = [
  { key: "build",   title: "Kickoff & build",         subtitle: "Counted from kickoff",                anchors: ["KICKOFF"] },
  { key: "week0",   title: "Road to Week 0",          subtitle: "Counted back from the build deadline", anchors: ["SEASON_WEEK0"] },
  { key: "events",  title: "Competitions",            subtitle: "Around each event",                    anchors: ["PRACTICE", "WEEK", "PLAYOFF", "WORLDS"] },
  { key: "end",     title: "Season end & offseason",  subtitle: "Wrapping up and beyond",               anchors: ["SEASON_END", "OFFSEASON"] },
];

export interface Check { ok: boolean; title: string; detail?: string }

/** Plain checks that point at what a template might be missing */
export function templateChecks(tasks: TimelineTask[], timeline: Timeline, subTeams: { value: string; label: string }[], dayLabel: (day: number) => string): Check[] {
  const checks: Check[] = [];
  const { items } = timeline;
  const used = new Set(tasks.map((t) => t.subTeam).filter(Boolean));
  const unused = subTeams.filter((s) => !used.has(s.value)).map((s) => s.label);
  checks.push(unused.length
    ? { ok: false, title: `No tasks for ${unused.join(", ")}`, detail: "Every sub-team usually has some work in the plan." }
    : { ok: true, title: "Every sub-team has tasks" });

  // Quiet stretches between kickoff and the last thing due
  const dues = [...new Set(items.map((i) => i.due))].sort((a, b) => a - b);
  const from = Math.min(0, dues[0] ?? 0);
  const points = [from, ...dues];
  const gaps: string[] = [];
  for (let i = 1; i < points.length; i++) {
    if (points[i] - points[i - 1] >= 14) gaps.push(`${dayLabel(points[i - 1])} → ${dayLabel(points[i])} (${points[i] - points[i - 1]} days)`);
  }
  checks.push(gaps.length
    ? { ok: false, title: `${gaps.length} long stretch${gaps.length === 1 ? "" : "es"} with nothing due`, detail: gaps.slice(0, 3).join(" · ") }
    : { ok: true, title: "Something is due at least every two weeks" });

  const milestones = tasks.filter((t) => t.isMilestone);
  checks.push(milestones.length === 0
    ? { ok: false, title: "No milestones", detail: "Milestones give the team checkpoints to aim for." }
    : { ok: true, title: `${milestones.length} milestone${milestones.length === 1 ? "" : "s"}` });

  const nearWeek0 = items.some((i) => i.isMilestone && (i.anchor === "SEASON_WEEK0" || i.anchor === "KICKOFF"));
  if (milestones.length) {
    checks.push(nearWeek0
      ? { ok: true, title: "Milestones lead up to the build deadline" }
      : { ok: false, title: "No milestones before Week 0", detail: "Add checkpoints such as “Drivetrain driving” or “Robot complete”." });
  }

  const noTeam = tasks.filter((t) => !t.subTeam && !t.isMilestone).length;
  checks.push(noTeam
    ? { ok: false, title: `${noTeam} task${noTeam === 1 ? "" : "s"} without a sub-team`, detail: "Nobody will see these as theirs." }
    : { ok: true, title: "Every task has a sub-team" });

  const noHours = tasks.filter((t) => !t.isMilestone && t.estimatedHours == null).length;
  checks.push(noHours
    ? { ok: false, title: `${noHours} task${noHours === 1 ? "" : "s"} without an hours estimate`, detail: "Estimates help balance work across the build." }
    : { ok: true, title: "Every task has an hours estimate" });

  const names = new Set(tasks.map((t) => t.name.trim().toLowerCase()));
  const missingPrereqs = [...new Set(tasks.flatMap((t) => t.prerequisiteNames).filter((p) => !names.has(p.trim().toLowerCase())))];
  if (missingPrereqs.length) checks.push({ ok: false, title: `${missingPrereqs.length} prerequisite${missingPrereqs.length === 1 ? "" : "s"} not in this template`, detail: missingPrereqs.slice(0, 4).join(", ") });

  // Timed from a task that isn't in the template, or tasks that follow each other in a loop
  if (timeline.broken.length) {
    const why = (r: UnplacedReason) => (r === "loop" ? "loop" : r === "missing-task" ? "task not in template" : "follows one of these");
    checks.push({
      ok: false,
      title: `${timeline.broken.length} task${timeline.broken.length === 1 ? "" : "s"} can't be timed from the task they follow`,
      detail: timeline.broken.slice(0, 4).map((b) => `${b.name} (${why(b.reason)})`).join(", ") + " — shown at kickoff; edit their timing.",
    });
  }

  if (timeline.seasonName && timeline.illustrative) {
    if (timeline.skipped.length) checks.push({ ok: false, title: `${timeline.skipped.length} need events the example season doesn't have`, detail: `Shown with estimated dates: ${timeline.skipped.slice(0, 4).join(", ")}${timeline.skipped.length > 4 ? "…" : ""}. They're skipped if your season has no matching event.` });
  } else if (timeline.seasonName) {
    checks.push(timeline.skipped.length
      ? { ok: false, title: `${timeline.skipped.length} would be skipped in ${timeline.seasonName}`, detail: `No matching date yet: ${timeline.skipped.slice(0, 4).join(", ")}${timeline.skipped.length > 4 ? "…" : ""}` }
      : { ok: true, title: `Everything has a date in ${timeline.seasonName}` });
  }
  return checks;
}

// ── Execution order ─────────────────────────────────────────────────────────

/**
 * Template tasks in the order they happen, as the template page lists them (and the CSV
 * export writes them): milestones by due date, then tasks by start (then due). Each is
 * placed on the example season so tasks counted from different dates compare properly;
 * "each competition" tasks go by their first one. Also returns each task's example
 * start/due (days from kickoff).
 */
export function executionOrder<T extends TimelineTask>(tasks: T[]): {
  milestones: T[];
  tasks: T[];
  at: (id: string) => { start: number; due: number };
} {
  const when = new Map<string, { start: number; due: number }>();
  for (const it of buildTimeline(tasks, illustrativeSeason()).items) {
    const prev = when.get(it.taskId);
    if (!prev || it.start < prev.start) when.set(it.taskId, { start: it.start, due: it.due });
  }
  const at = (id: string) => when.get(id) ?? { start: 0, due: 0 };
  return {
    milestones: tasks.filter((t) => t.isMilestone)
      .sort((a, b) => at(a.id).due - at(b.id).due || a.name.localeCompare(b.name)),
    tasks: tasks.filter((t) => !t.isMilestone)
      .sort((a, b) => at(a.id).start - at(b.id).start || at(a.id).due - at(b.id).due || a.name.localeCompare(b.name)),
    at,
  };
}
