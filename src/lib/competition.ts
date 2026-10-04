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

export const TASK_ANCHORS = ["KICKOFF", "SEASON_WEEK0", ...COMPETITION_STAGES] as const;
export type TaskAnchor = (typeof TASK_ANCHORS)[number];

export function isCompetitionAnchor(a: TaskAnchor): a is CompetitionStage {
  return (COMPETITION_STAGES as readonly string[]).includes(a);
}

export const ANCHOR_OPTIONS: { value: TaskAnchor; label: string }[] = [
  { value: "KICKOFF",      label: "Kickoff" },
  { value: "SEASON_WEEK0", label: "Season Week 0 date" },
  { value: "PRACTICE",     label: "Practice match (PracticeMatch#)" },
  { value: "WEEK",         label: "Week competition (Week#)" },
  { value: "PLAYOFF",      label: "Playoff (Playoff#)" },
  { value: "WORLDS",       label: "Worlds" },
  { value: "OFFSEASON",    label: "Offseason competition (Offseason#)" },
];

function anchorName(anchor: TaskAnchor, n: number | null | undefined): string {
  if (anchor === "KICKOFF") return "kickoff";
  if (anchor === "SEASON_WEEK0") return "Week 0";
  if (anchor === "WORLDS") return "Worlds";
  return n != null ? designation(anchor, n) : `each ${STAGE_INFO[anchor].label.toLowerCase()}`;
}

/** Human description, e.g. "3d after kickoff", "2d before each week competition", "on Week1". */
export function describeAnchor(anchor: TaskAnchor, anchorNumber: number | null | undefined, offset: number): string {
  const what = anchorName(anchor, anchorNumber);
  if (offset === 0) return `On ${what}`;
  return `${Math.abs(offset)}d ${offset < 0 ? "before" : "after"} ${what}`;
}

/** Old templates had no anchor: positive offsets counted from kickoff, negative from Week 0. */
export function legacyAnchor(offset: number): TaskAnchor {
  return offset < 0 ? "SEASON_WEEK0" : "KICKOFF";
}

// ── Resolving anchors against a season ─────────────────────────────────────

export interface SeasonDates {
  kickoffDate: Date;
  week0Date:   Date;
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
  if (anchor === "KICKOFF")      return [{ date: season.kickoffDate, suffix: null }];
  if (anchor === "SEASON_WEEK0") return [{ date: season.week0Date,   suffix: null }];

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

export function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}
