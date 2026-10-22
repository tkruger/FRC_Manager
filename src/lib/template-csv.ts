// CSV utilities for task templates

import { TASK_ANCHORS, STAGE_INFO, isCompetitionAnchor, legacyAnchor, type TaskAnchor } from "@/lib/competition";
import { csvCell } from "@/lib/csv";

export const CSV_HEADERS = [
  "name",
  "details",
  "subTeam",
  "startOffset",
  "durationBuildDays",
  "priority",
  "estimatedHours",
  "isMilestone",
  "designReviewRequired",
  "prerequisiteNames",
  "anchor",
  "anchorNumber",
  "anchorTaskName",
] as const;

export type CsvRow = {
  name:                 string;
  details:              string; // Markdown; may span lines (quoted)
  subTeam:              string;
  startOffset:          string;
  durationBuildDays:    string;
  priority:             string;
  estimatedHours:       string;
  isMilestone:          string;
  designReviewRequired: string;
  prerequisiteNames:    string; // pipe-separated
  anchor:               string;
  anchorNumber:         string;
  anchorTaskName:       string;
};

export function tasksToCSV(tasks: {
  name:                 string;
  details?:             string | null;
  subTeam?:             string | null;
  startOffset:          number;
  durationBuildDays:    number;
  priority:             string;
  estimatedHours?:      number | null;
  isMilestone:          boolean;
  designReviewRequired: boolean;
  prerequisiteNames:    string[];
  anchor?:              string | null;
  anchorNumber?:        number | null;
  anchorTaskName?:      string | null;
}[]): string {
  const rows = tasks.map((t) => [
    t.name,
    t.details ?? "",
    t.subTeam ?? "",
    String(t.startOffset),
    String(t.durationBuildDays),
    t.priority,
    String(t.estimatedHours ?? ""),
    t.isMilestone ? "true" : "false",
    t.designReviewRequired ? "true" : "false",
    (t.prerequisiteNames ?? []).join("|"),
    t.anchor ?? legacyAnchor(t.startOffset),
    t.anchorNumber != null ? String(t.anchorNumber) : "",
    t.anchor === "TASK" ? t.anchorTaskName ?? "" : "",
  ].map(csvCell).join(","));

  return [CSV_HEADERS.join(","), ...rows].join("\n");
}

export function emptyCSV(): string {
  return [
    CSV_HEADERS.join(","),
    "Example Task,Optional notes (Markdown),MECHANICAL,5,3,MEDIUM,,false,false,,KICKOFF,,",
    "Pack the robot,,OPERATIONS,-2,1,HIGH,,false,false,,WEEK,,",
    "Strategy debrief,,STRATEGY,0,2,MEDIUM,,false,false,Pack the robot,TASK,,Pack the robot",
    "# startOffset: when the task STARTS — days after (positive) or before (negative) the anchor",
    "# durationBuildDays: how many days it takes, counting both ends; it's due on day startOffset + durationBuildDays - 1 (milestones use 0)",
    "# anchor: KICKOFF SEASON_WEEK0 SEASON_END PRACTICE WEEK PLAYOFF WORLDS OFFSEASON TASK",
    "# anchorTaskName: with anchor TASK, the task in this template it counts from — startOffset is days after that task is due",
    "# anchorNumber: blank = every competition of that type (one task each); a number = only that one (e.g. WEEK + 1 = Week1)",
    "# subTeam: MECHANICAL ELECTRICAL PROGRAMMING DRIVE_TEAM STRATEGY DESIGN OUTREACH OPERATIONS",
    "# priority: CRITICAL HIGH MEDIUM LOW",
    "# prerequisiteNames: pipe-separated names e.g. Task One|Task Two",
  ].join("\n");
}

// ── Parser ──────────────────────────────────────────────────────────────────

export interface ParsedTask {
  name:                 string;
  details:              string | null;
  subTeam:              string | null;
  startOffset:          number;
  durationBuildDays:    number;
  priority:             string;
  estimatedHours:       number | null;
  isMilestone:          boolean;
  designReviewRequired: boolean;
  prerequisiteNames:    string[];
  anchor:               TaskAnchor;
  anchorNumber:         number | null;
  anchorTaskName:       string | null;
}

export interface ParseResult {
  tasks:  ParsedTask[];
  errors: string[];
}

const VALID_SUBTEAMS = new Set([
  "MECHANICAL","ELECTRICAL","PROGRAMMING","DRIVE_TEAM",
  "STRATEGY","DESIGN","OUTREACH","OPERATIONS","",
]);
const VALID_PRIORITIES = new Set(["CRITICAL","HIGH","MEDIUM","LOW"]);

/**
 * Splits CSV text into rows of cells. Quoted cells may contain commas, "" and line breaks
 * (multi-line Markdown details), so rows are found here rather than by splitting lines.
 */
function parseCSVRecords(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    if (inQuotes) {
      if (ch === '"' && content[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else cur += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(cur); cur = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && content[i + 1] === "\n") i++;
      row.push(cur); rows.push(row); row = []; cur = "";
    } else {
      cur += ch;
    }
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  // Undo the ' that exports put in front of formula-like text (see csvCell)
  return rows.map((r) => r.map((c) => (/^'[=+\-@\t\r]/.test(c) ? c.slice(1) : c.replace(/\r\n/g, "\n"))));
}

export function parseCSV(content: string): ParseResult {
  // Skip blank rows and # notes
  const lines = parseCSVRecords(content).filter((r) => r.some((c) => c.trim()) && !r[0].trim().startsWith("#"));
  if (lines.length < 2) return { tasks: [], errors: ["CSV must have a header row and at least one task row."] };

  const header = lines[0].map((h) => h.trim().toLowerCase());
  const nameIdx = header.indexOf("name");
  if (nameIdx === -1) return { tasks: [], errors: ["CSV must have a 'name' column."] };

  const idx = (col: string) => header.indexOf(col);

  const tasks: ParsedTask[] = [];
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i];
    const get = (col: string) => (cells[idx(col)] ?? "").trim();

    const name = get("name");
    if (!name) { errors.push(`Row ${i + 1}: name is required.`); continue; }

    const startOffset = parseInt(get("startoffset") || get("startOffset") || "0", 10);
    if (isNaN(startOffset)) { errors.push(`Row ${i + 1}: startOffset must be an integer.`); continue; }

    const dur = parseInt(get("durationbuilddays") || get("durationBuildDays") || "1", 10);
    const priority = (get("priority") || "MEDIUM").toUpperCase();
    if (!VALID_PRIORITIES.has(priority)) { errors.push(`Row ${i + 1}: invalid priority '${priority}'.`); continue; }

    const subTeamRaw = (get("subteam") || get("subTeam") || "").toUpperCase();
    if (!VALID_SUBTEAMS.has(subTeamRaw)) { errors.push(`Row ${i + 1}: invalid subTeam '${subTeamRaw}'.`); continue; }

    const estHoursRaw = get("estimatedhours") || get("estimatedHours") || "";
    const estimatedHours = estHoursRaw ? parseFloat(estHoursRaw) : null;

    const prereqRaw = get("prerequisitenames") || get("prerequisiteNames") || "";
    const prerequisiteNames = prereqRaw ? prereqRaw.split("|").map((s) => s.trim()).filter(Boolean) : [];

    // Older CSVs have no anchor column: positive offsets from kickoff, negative from Week 0
    const anchorRaw = get("anchor").toUpperCase();
    if (anchorRaw && !(TASK_ANCHORS as readonly string[]).includes(anchorRaw)) {
      errors.push(`Row ${i + 1}: invalid anchor '${anchorRaw}'.`); continue;
    }
    const anchor = (anchorRaw || legacyAnchor(startOffset)) as TaskAnchor;
    const numRaw = get("anchornumber");
    const anchorNumber = numRaw && isCompetitionAnchor(anchor) && STAGE_INFO[anchor].numbered ? parseInt(numRaw, 10) : null;
    if (anchorNumber != null && (isNaN(anchorNumber) || anchorNumber < 0)) {
      errors.push(`Row ${i + 1}: anchorNumber must be a whole number.`); continue;
    }
    const anchorTaskName = anchor === "TASK" ? get("anchortaskname") || null : null;
    if (anchor === "TASK" && !anchorTaskName) {
      errors.push(`Row ${i + 1}: anchor TASK needs anchorTaskName (the task it counts from).`); continue;
    }

    tasks.push({
      name,
      // Older files have a one-line "description" instead
      details:              (cells[idx("details")] ?? "").trim() || get("description") || null,
      subTeam:              subTeamRaw || null,
      startOffset,
      // Milestones may be 0 days (due on their start); tasks take at least a day
      durationBuildDays:    isNaN(dur) ? 1 : Math.max(get("ismilestone").toLowerCase() === "true" ? 0 : 1, dur),
      priority,
      estimatedHours:       estimatedHours && !isNaN(estimatedHours) ? estimatedHours : null,
      isMilestone:          get("ismilestone").toLowerCase() === "true",
      designReviewRequired: get("designreviewrequired").toLowerCase() === "true",
      prerequisiteNames,
      anchor,
      anchorNumber,
      anchorTaskName,
    });
  }

  // Tasks timed from a task must name one in the file
  const names = new Set(tasks.map((t) => t.name.trim().toLowerCase()));
  for (const t of tasks) {
    if (t.anchorTaskName && !names.has(t.anchorTaskName.trim().toLowerCase())) {
      errors.push(`“${t.name}” counts from “${t.anchorTaskName}”, which isn't in the file — it needs to be in the template already.`);
    }
  }

  return { tasks, errors };
}
