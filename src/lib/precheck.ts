// PRECHECK — FIRST's official self-inspection checklist (precheck.frc.nexus). Client-safe.
// Teams run it there; here we keep each robot's PRECHECK link and where it stands.

export const PRECHECK_HOME = "https://precheck.frc.nexus/";

export const PRECHECK_STATUSES = ["COMPLETE", "NEEDS_WORK", "INCOMPLETE"] as const;
export type PrecheckStatusValue = (typeof PRECHECK_STATUSES)[number];

export const PRECHECK_STATUS_INFO: Record<PrecheckStatusValue, { label: string; badge: "success" | "warning" | "neutral" }> = {
  COMPLETE:   { label: "Complete",   badge: "success" },
  NEEDS_WORK: { label: "Needs work", badge: "warning" },
  INCOMPLETE: { label: "Incomplete", badge: "neutral" },
};

/** A link to a team's PRECHECK, e.g. https://precheck.frc.nexus/VMNxV87s (FRC or FTC site) */
export function isPrecheckUrl(value: string): boolean {
  try {
    const u = new URL(value.trim());
    return u.protocol === "https:" && /^precheck\.f[rt]c\.nexus$/i.test(u.hostname) && /^\/[A-Za-z0-9_-]{4,}/.test(u.pathname);
  } catch {
    return false;
  }
}
