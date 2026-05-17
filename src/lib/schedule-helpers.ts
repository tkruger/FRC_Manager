import type { TaskStatus, TaskPriority, SubTeam } from "@/generated/prisma";

export const SUBTEAM_COLORS: Record<string, string> = {
  MECHANICAL:   "#C1121F",
  ELECTRICAL:   "#1D3A8A",
  PROGRAMMING:  "#059669",
  DRIVE_TEAM:   "#D97706",
  STRATEGY:     "#7C3AED",
  DESIGN:       "#0891B2",
  OUTREACH:     "#DB2777",
  OPERATIONS:   "#64748B",
};

export const STATUS_CONFIG: Record<TaskStatus, { label: string; variant: "success" | "warning" | "danger" | "info" | "neutral" }> = {
  NOT_STARTED: { label: "Not Started",  variant: "neutral" },
  IN_PROGRESS: { label: "In Progress",  variant: "info"    },
  BLOCKED:     { label: "Blocked",      variant: "danger"  },
  IN_REVIEW:   { label: "In Review",    variant: "warning" },
  COMPLETE:    { label: "Complete",     variant: "success" },
};

export const PRIORITY_CONFIG: Record<TaskPriority, { label: string; variant: "danger" | "warning" | "info" | "neutral" }> = {
  CRITICAL: { label: "Critical", variant: "danger"  },
  HIGH:     { label: "High",     variant: "warning" },
  MEDIUM:   { label: "Medium",   variant: "info"    },
  LOW:      { label: "Low",      variant: "neutral" },
};

export const SUBTEAM_OPTIONS = [
  { value: "MECHANICAL",  label: "Mechanical"  },
  { value: "ELECTRICAL",  label: "Electrical"  },
  { value: "PROGRAMMING", label: "Programming" },
  { value: "DRIVE_TEAM",  label: "Drive Team"  },
  { value: "STRATEGY",    label: "Strategy"    },
  { value: "DESIGN",      label: "Design"      },
  { value: "OUTREACH",    label: "Outreach"    },
  { value: "OPERATIONS",  label: "Operations"  },
];

export const STATUS_OPTIONS = [
  { value: "NOT_STARTED", label: "Not Started" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "BLOCKED",     label: "Blocked"     },
  { value: "IN_REVIEW",   label: "In Review"   },
  { value: "COMPLETE",    label: "Complete"     },
];

export const PRIORITY_OPTIONS = [
  { value: "CRITICAL", label: "Critical" },
  { value: "HIGH",     label: "High"     },
  { value: "MEDIUM",   label: "Medium"   },
  { value: "LOW",      label: "Low"      },
];

/** Days between two dates (positive = b after a) */
export function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

/** Clamp a value between min and max */
export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

/** ISO date string → "MMM D" */
export function shortDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Returns true if dueDate is in the past and task is not complete */
export function isOverdue(task: { dueDate: Date | null; status: TaskStatus }): boolean {
  if (!task.dueDate || task.status === "COMPLETE") return false;
  return task.dueDate < new Date();
}

/** Count build days between two dates given the team's meeting days */
export function buildDaysBetween(start: Date, end: Date, meetingDays: string[]): number {
  const DAY_MAP: Record<string, number> = { SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6 };
  const meetingNums = new Set(meetingDays.map((d) => DAY_MAP[d] ?? -1));
  let count = 0;
  const cur = new Date(start);
  while (cur <= end) {
    if (meetingNums.has(cur.getDay())) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}
