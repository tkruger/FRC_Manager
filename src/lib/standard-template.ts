// Standard FRC season template — shared between actions and API routes.
//
// A starting point for any team: kickoff and early design, the build up to Week 0, each
// competition, and the end of the season. Week 0 is the week before the Week 1 events
// (the build deadline). Some tasks are timed from other tasks (anchor TASK) — e.g. the
// debrief after each event — so they move with them. Lengths count both ends: T(…, start, 4)
// runs start…start+3 (Thursday–Sunday), and a task after another starts the day after it's due.

import type { TaskAnchor } from "@/lib/competition";

export interface StandardTask {
  name:              string;
  /** Longer Markdown notes, copied to the task */
  details?:          string;
  subTeam:           string | null;
  startOffset:       number;
  durationBuildDays: number;
  priority:          string;
  estimatedHours?:   number;
  isMilestone:       boolean;
  designReviewRequired: boolean;
  prerequisiteNames: string[];
  /** What startOffset counts from */
  anchor:            TaskAnchor;
  anchorNumber?:     number | null;
  /** With anchor TASK: the task (by name) whose due date this one counts from */
  anchorTaskName?:   string | null;
}

type Team = "MECHANICAL" | "ELECTRICAL" | "PROGRAMMING" | "DRIVE_TEAM" | "STRATEGY" | "DESIGN" | "OUTREACH" | "OPERATIONS" | null;
type Priority = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
type Extra = Partial<Pick<StandardTask, "anchorNumber" | "prerequisiteNames" | "designReviewRequired" | "details">>;
/** "After" a task: anchor TASK, counted from that task's due date */
type When = TaskAnchor | { after: string };

const anchorOf = (w: When) => (typeof w === "string" ? { anchor: w, anchorTaskName: null } : { anchor: "TASK" as const, anchorTaskName: w.after });

/** A milestone due `due` days from the anchor */
function M(name: string, subTeam: Team, priority: Priority, when: When, due: number, x: Extra = {}): StandardTask {
  return { name, subTeam, priority, ...anchorOf(when), startOffset: due, durationBuildDays: 0, isMilestone: true,
    designReviewRequired: false, prerequisiteNames: [], ...x };
}
/** A task that starts `start` days from the anchor and takes `days` days */
function T(name: string, subTeam: Team, priority: Priority, when: When, start: number, days: number, x: Extra = {}): StandardTask {
  return { name, subTeam, priority, ...anchorOf(when), startOffset: start, durationBuildDays: days, isMilestone: false,
    designReviewRequired: false, prerequisiteNames: [], ...x };
}
/** The same task for the three build sub-teams */
const perBuildTeam = (name: (team: string) => string, priority: Priority, when: When, start: number, days: number, x: Extra = {}) =>
  ([["Mechanical", "MECHANICAL"], ["Electrical", "ELECTRICAL"], ["Programming", "PROGRAMMING"]] as const)
    .map(([label, team]) => T(name(label), team, priority, when, start, days, x));

export const STANDARD_TASKS: StandardTask[] = [
  // ── Before kickoff ──────────────────────────────────────────────────────────
  T("Drivetrain ready for the new season", "MECHANICAL", "HIGH", "KICKOFF", -14, 12, {
    details: "Service last season's drivetrain (or modules) so it's ready to drive the week of kickoff:\n\n- [ ] Inspect and replace worn wheels, belts and bearings\n- [ ] Check motors and encoders\n- [ ] Restock spare modules and parts",
  }),
  T("Electrical test board & spares ready", "ELECTRICAL", "MEDIUM", "KICKOFF", -14, 12),
  T("Code base ready for the new season", "PROGRAMMING", "HIGH", "KICKOFF", -7, 6, {
    details: "- [ ] Install this year's WPILib and vendor libraries\n- [ ] New repository/branch from last year's framework\n- [ ] Update roboRIO, radio and motor-controller firmware",
  }),
  T("Kickoff day plan", "OPERATIONS", "MEDIUM", "KICKOFF", -10, 9, { details: "Where to watch, food, and who's on which analysis group." }),

  // ── Kickoff week: understand the game ───────────────────────────────────────
  T("Game manual review", "STRATEGY", "CRITICAL", "KICKOFF", 0, 2),
  T("Game piece & field research", "STRATEGY", "HIGH", "KICKOFF", 0, 3),
  T("Order field element materials", "OPERATIONS", "CRITICAL", "KICKOFF", 0, 1),
  T("Build practice field elements", "OPERATIONS", "HIGH", { after: "Order field element materials" }, 1, 10, {
    prerequisiteNames: ["Order field element materials"],
  }),
  M("Game analysis complete", "STRATEGY", "HIGH", "KICKOFF", 2, {
    details: "Scoring breakdown, cycle-time estimates, endgame value and the rules that limit robots (size, extension, contact).",
  }),
  M("Robot strategy & design brief", "DESIGN", "HIGH", { after: "Game analysis complete" }, 2, {
    prerequisiteNames: ["Game analysis complete"],
    details: "What the robot must do, should do and won't do, ranked — the brief every design decision is checked against.",
  }),
  T("Place first parts order (rush)", "OPERATIONS", "CRITICAL", "KICKOFF", 2, 1),
  T("Practice drivetrain driving", "MECHANICAL", "CRITICAL", "KICKOFF", 2, 3, {
    details: "A drivetrain (practice robot / alphabot) for programming and drivers to use right away.",
  }),
  T("Auto paths built & tested on the practice drivetrain", "PROGRAMMING", "HIGH", { after: "Practice drivetrain driving" }, 1, 10),
  T("Test bumpers for the practice drivetrain", "MECHANICAL", "MEDIUM", { after: "Practice drivetrain driving" }, 3, 2),

  // ── Prototype and decide ────────────────────────────────────────────────────
  T("Prototype key mechanisms", "MECHANICAL", "HIGH", "KICKOFF", 2, 12),
  M("First round of prototyping complete", "MECHANICAL", "HIGH", "KICKOFF", 6),
  M("Idea pool narrowed (“the purge”)", "DESIGN", "CRITICAL", "KICKOFF", 6, {
    designReviewRequired: true,
    details: "Cut the ideas down to the few worth prototyping further, judged against the strategy brief.",
  }),
  M("Robot dimensions & architecture locked", "MECHANICAL", "CRITICAL", "KICKOFF", 7, {
    designReviewRequired: true,
    details: "- [ ] Frame perimeter and height\n- [ ] Where each mechanism lives, and extension limits\n- [ ] Weight budget per subsystem",
  }),
  T("Electrical system design", "ELECTRICAL", "HIGH", { after: "Robot dimensions & architecture locked" }, 0, 7, { designReviewRequired: true }),
  T("Software architecture & subsystem plan", "PROGRAMMING", "HIGH", { after: "Robot dimensions & architecture locked" }, 0, 7),
  M("First full design review", "DESIGN", "CRITICAL", "KICKOFF", 10, { designReviewRequired: true }),
  T("Place second parts order", "OPERATIONS", "CRITICAL", { after: "First full design review" }, 0, 1),
  T("Start building what's already locked", "MECHANICAL", "HIGH", { after: "First full design review" }, 0, 4),
  M("Prototyping complete", "MECHANICAL", "HIGH", "KICKOFF", 14),
  M("Design locked", "DESIGN", "CRITICAL", "KICKOFF", 14, {
    designReviewRequired: true, prerequisiteNames: ["First full design review"],
  }),
  T("Order remaining parts (rush)", "OPERATIONS", "CRITICAL", { after: "Design locked" }, 0, 1),
  ...perBuildTeam((t) => `Break the design into ${t.toLowerCase()} tasks`, "CRITICAL", { after: "Design locked" }, 0, 2),
  M("Programming design reviews complete", "PROGRAMMING", "CRITICAL", "KICKOFF", 17, { designReviewRequired: true }),
  M("Draft full robot CAD ready for review", "DESIGN", "HIGH", "KICKOFF", 18, { designReviewRequired: true }),
  M("Full robot CAD complete", "DESIGN", "HIGH", "KICKOFF", 21),

  // ── Build: counted back from Week 0 ─────────────────────────────────────────
  M("Robot build starts", "MECHANICAL", "CRITICAL", "SEASON_WEEK0", -26, { prerequisiteNames: ["Design locked"] }),
  T("Competition drivetrain assembled & driving", "MECHANICAL", "CRITICAL", { after: "Robot build starts" }, 0, 4),
  ...perBuildTeam((t) => (t === "Programming" ? "Robot programming" : `Robot build — ${t}`), "CRITICAL", { after: "Robot build starts" }, 0, 18),
  M("All subsystems integrated", "MECHANICAL", "CRITICAL", "SEASON_WEEK0", -14, {
    prerequisiteNames: ["Competition drivetrain assembled & driving"],
  }),
  T("Autonomous routines on the competition robot", "PROGRAMMING", "CRITICAL", { after: "All subsystems integrated" }, 0, 7),
  T("Durability testing", "DRIVE_TEAM", "CRITICAL", { after: "All subsystems integrated" }, 0, 5, {
    details: "Run full matches back to back. Note anything that loosens, breaks or overheats, and fix it before it's on the field.",
  }),
  T("Competition bumpers", "MECHANICAL", "HIGH", "SEASON_WEEK0", -12, 4, {
    details: "Both alliance colors, team numbers per the rules, and test the fit on the competition robot.",
  }),
  M("Robot weight confirmed under limit", "MECHANICAL", "HIGH", "SEASON_WEEK0", -10),
  T("Order competition spares", "OPERATIONS", "HIGH", "SEASON_WEEK0", -12, 2, { details: "Spare mechanism parts, motors, wheels, belts and electronics." }),
  M("Robot done", null, "CRITICAL", "SEASON_WEEK0", -8, {
    prerequisiteNames: ["All subsystems integrated", "Robot weight confirmed under limit"],
    details: "Feature-complete and at weight. From here on it's driver practice, tuning and fixes.",
  }),
  T("Driver practice", "DRIVE_TEAM", "HIGH", { after: "Robot done" }, 0, 7),
  T("Impact Award & Woodie Flowers submissions", "OUTREACH", "HIGH", "SEASON_WEEK0", -21, 14, {
    details: "Check this season's deadlines on the FIRST website — they're usually before the first events.",
  }),
  T("Pit display & team handout", "OUTREACH", "MEDIUM", "SEASON_WEEK0", -10, 7),
  T("Competition packing list & pit kit", "OPERATIONS", "HIGH", "SEASON_WEEK0", -5, 3),
  M("Robot documentation package complete", "OPERATIONS", "MEDIUM", "SEASON_WEEK0", -1, {
    details: "- [ ] Bill of materials and costs\n- [ ] Inspection checklist\n- [ ] Wiring diagram\n- [ ] Code tagged and backed up",
  }),

  // ── Week 0 ──────────────────────────────────────────────────────────────────
  T("Week 0 scrimmage (if attending)", "DRIVE_TEAM", "MEDIUM", "SEASON_WEEK0", 0, 2),
  T("Strategy review after Week 0", "STRATEGY", "MEDIUM", { after: "Week 0 scrimmage (if attending)" }, 1, 2),
  ...perBuildTeam((t) => `Hardening after Week 0 — ${t}`, "MEDIUM", { after: "Week 0 scrimmage (if attending)" }, 1, 5),

  // ── Each week competition ───────────────────────────────────────────────────
  T("Scouting plan & match strategy", "STRATEGY", "HIGH", "WEEK", -4, 3),
  T("Driver practice before the event", "DRIVE_TEAM", "HIGH", "WEEK", -5, 4),
  T("Pack robot & pit", "OPERATIONS", "HIGH", "WEEK", -1, 1),
  T("Event", "DRIVE_TEAM", "CRITICAL", "WEEK", 0, 2, { details: "Saturday–Sunday." }),
  T("Strategy debrief", "STRATEGY", "MEDIUM", { after: "Event" }, 1, 2, { prerequisiteNames: ["Event"] }),
  ...perBuildTeam((t) => `Fixes & improvements after the event — ${t}`, "MEDIUM", { after: "Event" }, 1, 5),

  // ── District championship / playoffs ───────────────────────────────────────
  T("Driver practice before the playoffs", "DRIVE_TEAM", "HIGH", "PLAYOFF", -5, 4),
  T("Pack for the playoffs", "OPERATIONS", "HIGH", "PLAYOFF", -1, 1),
  T("District championship", "DRIVE_TEAM", "CRITICAL", "PLAYOFF", 0, 3, { details: "Usually Thursday–Saturday — set the event's first day in Season settings." }),
  ...perBuildTeam((t) => `Fixes & improvements after the playoffs — ${t}`, "MEDIUM", { after: "District championship" }, 1, 5),

  // ── Worlds ──────────────────────────────────────────────────────────────────
  T("Worlds travel & logistics", "OPERATIONS", "HIGH", "WORLDS", -28, 21, { details: "Registration, travel, hotel, shipping the robot." }),
  T("Worlds driver practice", "DRIVE_TEAM", "CRITICAL", "WORLDS", -12, 10),
  T("Worlds", "DRIVE_TEAM", "CRITICAL", "WORLDS", 0, 4, { details: "Thursday–Sunday — set the first day (Thursday) as Worlds' date in Season settings." }),

  // ── Season end ──────────────────────────────────────────────────────────────
  T("Season retrospective", null, "MEDIUM", "SEASON_END", 1, 7, {
    details: "What worked, what didn't, and what to change next season — while it's fresh.",
  }),
  T("Sponsor thank-yous & season recap", "OUTREACH", "MEDIUM", "SEASON_END", 1, 14),
  T("Inventory & robot storage", "OPERATIONS", "LOW", "SEASON_END", 1, 7),
];
