// CSV utilities for task templates

import { TASK_ANCHORS, STAGE_INFO, isCompetitionAnchor, legacyAnchor, type TaskAnchor } from "@/lib/competition";

export const CSV_HEADERS = [
  "name",
  "description",
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
] as const;

export type CsvRow = {
  name:                 string;
  description:          string;
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
};

function escapeCell(v: unknown): string {
  const s = String(v ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function tasksToCSV(tasks: {
  name:                 string;
  description?:         string | null;
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
}[]): string {
  const rows = tasks.map((t) => [
    t.name,
    t.description ?? "",
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
  ].map(escapeCell).join(","));

  return [CSV_HEADERS.join(","), ...rows].join("\n");
}

export function emptyCSV(): string {
  return [
    CSV_HEADERS.join(","),
    "Example Task,Optional description,MECHANICAL,5,3,MEDIUM,,false,false,,KICKOFF,",
    "Pack the robot,,OPERATIONS,-2,1,HIGH,,false,false,,WEEK,",
    "# startOffset: days after (positive) or before (negative) the anchor",
    "# anchor: KICKOFF SEASON_WEEK0 SEASON_END PRACTICE WEEK PLAYOFF WORLDS OFFSEASON",
    "# anchorNumber: blank = every competition of that type (one task each); a number = only that one (e.g. WEEK + 1 = Week1)",
    "# subTeam: MECHANICAL ELECTRICAL PROGRAMMING DRIVE_TEAM STRATEGY DESIGN OUTREACH OPERATIONS",
    "# priority: CRITICAL HIGH MEDIUM LOW",
    "# prerequisiteNames: pipe-separated names e.g. Task One|Task Two",
  ].join("\n");
}

// ── Parser ──────────────────────────────────────────────────────────────────

export interface ParsedTask {
  name:                 string;
  description:          string;
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

function parseCSVLine(line: string): string[] {
  const cells: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      cells.push(cur); cur = "";
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells;
}

export function parseCSV(content: string): ParseResult {
  const lines = content.split(/\r?\n/).filter((l) => l.trim() && !l.trim().startsWith("#"));
  if (lines.length < 2) return { tasks: [], errors: ["CSV must have a header row and at least one task row."] };

  const header = parseCSVLine(lines[0]).map((h) => h.trim().toLowerCase());
  const nameIdx = header.indexOf("name");
  if (nameIdx === -1) return { tasks: [], errors: ["CSV must have a 'name' column."] };

  const idx = (col: string) => header.indexOf(col);

  const tasks: ParsedTask[] = [];
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = parseCSVLine(lines[i]);
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

    tasks.push({
      name,
      description:          get("description"),
      subTeam:              subTeamRaw || null,
      startOffset,
      durationBuildDays:    isNaN(dur) ? 1 : Math.max(1, dur),
      priority,
      estimatedHours:       estimatedHours && !isNaN(estimatedHours) ? estimatedHours : null,
      isMilestone:          get("ismilestone").toLowerCase() === "true",
      designReviewRequired: get("designreviewrequired").toLowerCase() === "true",
      prerequisiteNames,
      anchor,
      anchorNumber,
    });
  }

  return { tasks, errors };
}
