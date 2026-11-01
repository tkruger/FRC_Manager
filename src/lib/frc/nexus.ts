// FRC Nexus — live queuing at events that use it ("Now queuing", "On deck", "On field"). Server-only.
//
//   NEXUS_API_KEY        a key from frc.nexus/api. Without it, queuing alerts fall back to TBA's predicted match times.
//   NEXUS_WEBHOOK_TOKEN  the token Nexus sends with its webhook (Nexus-Token header), so updates arrive right away.

const BASE = "https://frc.nexus/api/v1";

export function nexusConfigured(): boolean {
  return !!process.env.NEXUS_API_KEY;
}

export interface NexusMatch {
  /** "Qualification 19", "Playoff 8", "Final 1", "Practice 3" */
  label: string;
  /** "Queuing soon", "Now queuing", "On deck", "On field" … */
  status: string | null;
  redTeams: (string | null)[] | null;
  blueTeams: (string | null)[] | null;
  /** Unix milliseconds */
  times: {
    estimatedQueueTime?: number | null; estimatedOnDeckTime?: number | null;
    estimatedOnFieldTime?: number | null; estimatedStartTime?: number | null; actualQueueTime?: number | null;
  } | null;
}

export interface NexusEventStatus {
  eventKey: string;
  dataAsOfTime: number;
  nowQueuing: string | null;
  matches: NexusMatch[];
}

export async function nexusEventStatus(eventKey: string): Promise<NexusEventStatus | null> {
  const key = process.env.NEXUS_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(`${BASE}/event/${eventKey}`, {
      headers: { "Nexus-Api-Key": key, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    // Events that don't use Nexus aren't there
    if (!res.ok) {
      if (res.status !== 404) console.warn(`[nexus] ${eventKey} → ${res.status}`);
      return null;
    }
    return (await res.json()) as NexusEventStatus;
  } catch (e) {
    console.warn(`[nexus] ${eventKey} failed:`, e instanceof Error ? e.message : e);
    return null;
  }
}

/** Our side of a Nexus match, or null if we're not in it */
export function nexusSide(m: NexusMatch, team: number): "red" | "blue" | null {
  const t = String(team);
  if (m.redTeams?.includes(t)) return "red";
  if (m.blueTeams?.includes(t)) return "blue";
  return null;
}

/** "Qualification 19" → "Qual 19" (the app's own labels) */
export const shortLabel = (label: string) => label.replace(/^Qualification\b/, "Qual");
