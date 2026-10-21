// Competition stages and template-task anchors. Client-safe (no database access).

export const COMPETITION_STAGES = ["PRACTICE", "WEEK", "PLAYOFF", "WORLDS", "OFFSEASON"] as const;
export type CompetitionStage = (typeof COMPETITION_STAGES)[number];

export const STAGE_INFO: Record<CompetitionStage, {
  label:      string;   // "Practice match"
  plural:     string;   // "practice matches"
  prefix:     string;   // designation prefix, e.g. "PracticeMatch" → "PracticeMatch1"
  numbered:   boolean;
  firstNumber: number;  // suggested number for the first event of this stage
  eventType:  "REGIONAL" | "DISTRICT_CHAMPIONSHIP" | "CHAMPIONSHIP" | "WEEK_0" | "OFFSEASON";
}> = {
  PRACTICE:  { label: "Practice match", plural: "practice matches",   prefix: "PracticeMatch", numbered: true,  firstNumber: 1, eventType: "OFFSEASON" },
  WEEK:      { label: "Week competition", plural: "week competitions", prefix: "Week",         numbered: true,  firstNumber: 0, eventType: "REGIONAL" },
  PLAYOFF:   { label: "Playoff",        plural: "playoffs",           prefix: "Playoff",       numbered: true,  firstNumber: 0, eventType: "DISTRICT_CHAMPIONSHIP" },
  WORLDS:    { label: "Worlds",         plural: "Worlds",             prefix: "Worlds",        numbered: false, firstNumber: 0, eventType: "CHAMPIONSHIP" },
  OFFSEASON: { label: "Offseason competition", plural: "offseason competitions", prefix: "Offseason", numbered: true, firstNumber: 1, eventType: "OFFSEASON" },
};

/** e.g. "PracticeMatch1", "Week0", "Playoff0", "Worlds", "Offseason2" */
export function designation(stage: CompetitionStage, stageNumber: number | null | undefined): string {
  const info = STAGE_INFO[stage];
  return info.numbered && stageNumber != null ? `${info.prefix}${stageNumber}` : info.prefix;
}

// ── Template task anchors ───────────────────────────────────────────────────

/** TASK: counts from another task in the same template (its due date) — see anchorTaskName */
export const TASK_ANCHORS = ["KICKOFF", "SEASON_WEEK0", "SEASON_END", ...COMPETITION_STAGES, "TASK"] as const;
export type TaskAnchor = (typeof TASK_ANCHORS)[number];

export function isCompetitionAnchor(a: TaskAnchor): a is CompetitionStage {
  return (COMPETITION_STAGES as readonly string[]).includes(a);
}

export const ANCHOR_OPTIONS: { value: TaskAnchor; label: string }[] = [
  { value: "KICKOFF",      label: "Kickoff (season start)" },
  { value: "SEASON_WEEK0", label: "Week 0 (the week before Week 1 events)" },
  { value: "SEASON_END",   label: "Season end" },
  { value: "PRACTICE",     label: "Practice match (PracticeMatch#)" },
  { value: "WEEK",         label: "Week competition (Week#)" },
  { value: "PLAYOFF",      label: "Playoff (Playoff#)" },
  { value: "WORLDS",       label: "Worlds" },
  { value: "OFFSEASON",    label: "Offseason competition (Offseason#)" },
];

/** "kickoff", "Week 0", "Week1", "each week competition", "“Robot design locked”" */
export function anchorName(anchor: TaskAnchor, n: number | null | undefined, taskName?: string | null): string {
  if (anchor === "TASK") return taskName ? `“${taskName}”` : "another task";
  if (anchor === "KICKOFF") return "kickoff";
  if (anchor === "SEASON_WEEK0") return "Week 0";
  if (anchor === "SEASON_END") return "season end";
  if (anchor === "WORLDS") return "Worlds";
  return n != null ? designation(anchor, n) : `each ${STAGE_INFO[anchor].label.toLowerCase()}`;
}

/** Human description, e.g. "3d after kickoff", "2d before each week competition", "on Week1". */
export function describeAnchor(anchor: TaskAnchor, anchorNumber: number | null | undefined, offset: number, taskName?: string | null): string {
  const what = anchorName(anchor, anchorNumber, taskName) + (anchor === "TASK" ? " is due" : "");
  if (offset === 0) return anchor === "TASK" ? `When ${what}` : `On ${what}`;
  return `${Math.abs(offset)}d ${offset < 0 ? "before" : "after"} ${what}`;
}

/** Old templates had no anchor: positive offsets counted from kickoff, negative from Week 0. */
export function legacyAnchor(offset: number): TaskAnchor {
  return offset < 0 ? "SEASON_WEEK0" : "KICKOFF";
}

// ── Resolving anchors against a season ─────────────────────────────────────

export interface SeasonDates {
  kickoffDate: Date;
  endDate:     Date;
  competitions: { name: string; stage: CompetitionStage; stageNumber: number | null; startDate: Date }[];
}

export interface AnchorTarget {
  date:   Date;
  /** Added to the task name when one template task becomes several (e.g. "Week1") */
  suffix: string | null;
}

/**
 * The date(s) a template task counts from. Competition anchors without a number
 * return every matching competition (one task each); an empty list means the
 * season has no such competition, so the task is skipped.
 */
export function resolveAnchor(anchor: TaskAnchor, anchorNumber: number | null | undefined, season: SeasonDates): AnchorTarget[] {
  if (anchor === "KICKOFF")    return [{ date: season.kickoffDate, suffix: null }];
  if (anchor === "SEASON_END") return [{ date: season.endDate,     suffix: null }];
  // Week 0 always has a date (see week0Date), so its tasks are never skipped
  if (anchor === "SEASON_WEEK0") return [{ date: week0Date(season).date, suffix: null }];
  // Counted from another task — placed by scheduleTemplate, not from the season's dates
  if (anchor === "TASK") return [];

  const matches = season.competitions
    .filter((c) => c.stage === anchor && (anchorNumber == null || c.stageNumber === anchorNumber))
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

  // "Each" anchors always name the competition, so names stay unique (and re-applying
  // the template after adding another competition only creates the new one).
  return matches.map((c) => ({
    date:   c.startDate,
    suffix: anchorNumber != null ? null
          : STAGE_INFO[anchor].numbered ? designation(c.stage, c.stageNumber)
          : matches.length > 1 ? c.name : null,
  }));
}

const DAY_MS = 86_400_000;

/** What Week 0/1 are worked out from */
type WeekDates = { kickoffDate: Date; competitions: { stage: CompetitionStage; stageNumber: number | null; startDate: Date }[] };

/**
 * Week 1 of the FRC season: the season's Week1 event, else worked back from its other
 * numbered Week events (Week 3 − 2 weeks), else the typical FRC schedule — the Saturday
 * about seven weeks after kickoff (events run Saturday–Sunday).
 */
export function week1Date(season: WeekDates): { date: Date; source: "event" | "derived" | "estimate" } {
  const numbered = season.competitions
    .filter((c) => c.stage === "WEEK" && c.stageNumber != null && c.stageNumber >= 1)
    .sort((a, b) => a.stageNumber! - b.stageNumber! || a.startDate.getTime() - b.startDate.getTime());
  const first = numbered[0];
  if (first) {
    return {
      date: new Date(first.startDate.getTime() - (first.stageNumber! - 1) * 7 * DAY_MS),
      source: first.stageNumber === 1 ? "event" : "derived",
    };
  }
  const sevenWeeks = new Date(season.kickoffDate.getTime() + 49 * DAY_MS);
  const backToSaturday = (sevenWeeks.getUTCDay() - 6 + 7) % 7;
  return { date: new Date(sevenWeeks.getTime() - backToSaturday * DAY_MS), source: "estimate" };
}

/**
 * Week 0 — the build deadline — is the week before the Week 1 events: the season's Week0
 * event if it has one, else 7 days before Week 1 (see week1Date). Always has a date.
 */
export function week0Date(season: WeekDates): { date: Date; source: "event" | "derived" | "estimate" } {
  const event = season.competitions
    .filter((c) => c.stage === "WEEK" && c.stageNumber === 0)
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())[0];
  if (event) return { date: event.startDate, source: "event" };
  const w1 = week1Date(season);
  return { date: new Date(w1.date.getTime() - 7 * DAY_MS), source: w1.source === "estimate" ? "estimate" : "derived" };
}

/** The next competition that hasn't finished yet (for countdowns) */
export function nextCompetition<T extends { startDate: Date; endDate: Date }>(competitions: T[], now = new Date()): T | null {
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  return [...competitions].filter((c) => c.endDate >= today).sort((a, b) => a.startDate.getTime() - b.startDate.getTime())[0] ?? null;
}

export function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

/** Countdown to the next competition — its name (e.g. "Chesapeake District Championship"), its
 *  code (e.g. "Week1") and days to go — or null when none are left */
export function competitionCountdown(
  competitions: { name: string; stage: CompetitionStage; stageNumber: number | null; startDate: Date; endDate: Date }[],
  now = new Date(),
): { name: string; designation: string; days: number } | null {
  const next = nextCompetition(competitions, now);
  if (!next) return null;
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const start = new Date(next.startDate); start.setHours(0, 0, 0, 0);
  return { name: next.name, designation: designation(next.stage, next.stageNumber), days: Math.round((start.getTime() - today.getTime()) / 86_400_000) };
}
