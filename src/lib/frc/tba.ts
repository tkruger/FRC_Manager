// The Blue Alliance API v3 — events, match schedules, alliances, scores, rankings. Server-only.
//
//   TBA_API_KEY  a free Read API key (thebluealliance.com → Account → Read API Keys).
//                Without it these return null and pages show links only.
//
// Answers are cached briefly (a minute during an event), so pages stay fast and TBA isn't
// asked the same thing over and over.

const BASE = "https://www.thebluealliance.com/api/v3";

export function tbaConfigured(): boolean {
  return !!process.env.TBA_API_KEY;
}

async function tba<T>(path: string, revalidate: number): Promise<T | null> {
  const key = process.env.TBA_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { "X-TBA-Auth-Key": key, Accept: "application/json" },
      next: { revalidate },
      signal: AbortSignal.timeout(8_000),
    });
    if (res.status === 404) return null;
    if (!res.ok) {
      console.warn(`[tba] ${path} → ${res.status}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (e) {
    console.warn(`[tba] ${path} failed:`, e instanceof Error ? e.message : e);
    return null;
  }
}

export interface TbaEventSimple {
  key: string; name: string; event_code: string; event_type: number;
  city: string | null; state_prov: string | null; country: string | null;
  start_date: string; end_date: string; year: number;
}

export interface TbaWebcast { type: string; channel: string; date?: string | null; file?: string | null }

export interface TbaEvent extends TbaEventSimple {
  short_name: string | null; website: string | null; location_name: string | null; timezone: string | null;
  webcasts: TbaWebcast[]; week: number | null;
}

interface TbaAlliance { score: number; team_keys: string[]; surrogate_team_keys: string[]; dq_team_keys: string[] }

export interface TbaMatch {
  key: string; comp_level: "qm" | "ef" | "qf" | "sf" | "f"; set_number: number; match_number: number;
  alliances: { red: TbaAlliance; blue: TbaAlliance };
  winning_alliance: "red" | "blue" | "";
  event_key: string;
  /** Unix seconds */
  time: number | null; actual_time: number | null; predicted_time: number | null; post_result_time: number | null;
  videos: { type: string; key: string }[];
}

export interface TbaTeamEventStatus {
  qual: {
    num_teams: number | null;
    ranking: { rank: number | null; matches_played: number; record: { wins: number; losses: number; ties: number } | null } | null;
    status: string | null;
  } | null;
  alliance: { name: string | null; number: number; pick: number } | null;
  playoff: { level: string; status: string; record: { wins: number; losses: number; ties: number } | null } | null;
  /** Plain text after stripping TBA's HTML */
  overall_status_str: string | null;
  next_match_key: string | null;
  last_match_key: string | null;
}

const teamKey = (team: number) => `frc${team}`;

/** The team's events in a season */
export const teamEvents = (team: number, year: number) =>
  tba<TbaEvent[]>(`/team/${teamKey(team)}/events/${year}`, 3600);

export const event = (eventKey: string) => tba<TbaEvent>(`/event/${eventKey}`, 1800);

/** The team's matches at an event (the schedule, then scores as they're played) */
export const teamEventMatches = (team: number, eventKey: string) =>
  tba<TbaMatch[]>(`/team/${teamKey(team)}/event/${eventKey}/matches`, 60);

export async function teamEventStatus(team: number, eventKey: string): Promise<TbaTeamEventStatus | null> {
  const s = await tba<TbaTeamEventStatus>(`/team/${teamKey(team)}/event/${eventKey}/status`, 60);
  if (!s) return null;
  return { ...s, overall_status_str: s.overall_status_str?.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim() ?? null };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const LEVEL_ORDER = { qm: 0, ef: 1, qf: 2, sf: 3, f: 4 } as const;

export function sortMatches<T extends Pick<TbaMatch, "comp_level" | "set_number" | "match_number">>(list: T[]): T[] {
  return [...list].sort((a, b) => LEVEL_ORDER[a.comp_level] - LEVEL_ORDER[b.comp_level] || a.set_number - b.set_number || a.match_number - b.match_number);
}

/** "Qual 14", "Playoff 7", "Final 2", "Quarterfinal 2-1" */
export function matchLabel(m: Pick<TbaMatch, "comp_level" | "set_number" | "match_number">, year: number): string {
  switch (m.comp_level) {
    case "qm": return `Qual ${m.match_number}`;
    case "f":  return `Final ${m.match_number}`;
    // Double-elimination playoffs (2023 on) number each match as its own set
    case "sf": return year >= 2023 ? `Playoff ${m.set_number}` : `Semifinal ${m.set_number}-${m.match_number}`;
    case "qf": return `Quarterfinal ${m.set_number}-${m.match_number}`;
    case "ef": return `Eighthfinal ${m.set_number}-${m.match_number}`;
  }
}

/** Where to watch a webcast */
export function webcastUrl(w: TbaWebcast): string | null {
  switch (w.type) {
    case "twitch":  return `https://www.twitch.tv/${w.channel}`;
    case "youtube": return `https://www.youtube.com/watch?v=${w.channel}`;
    case "direct_link": return w.channel?.startsWith("http") ? w.channel : null;
    default: return null;
  }
}

/** Our side of a match: color, partners, opponents, result */
export function ourSide(m: TbaMatch, team: number) {
  const key = teamKey(team);
  const color: "red" | "blue" = m.alliances.red.team_keys.includes(key) ? "red" : "blue";
  const other = color === "red" ? "blue" : "red";
  const num = (k: string) => Number(k.replace(/^frc/, ""));
  const played = m.alliances.red.score >= 0 && m.alliances.blue.score >= 0 && (m.actual_time != null || m.post_result_time != null || m.winning_alliance !== "");
  return {
    color,
    partners:  m.alliances[color].team_keys.filter((k) => k !== key).map(num),
    opponents: m.alliances[other].team_keys.map(num),
    ourScore:  played ? m.alliances[color].score : null,
    theirScore: played ? m.alliances[other].score : null,
    result:    !played ? null : m.winning_alliance === color ? "win" : m.winning_alliance === other ? "loss" : "tie",
    /** Best guess of when it starts (Unix seconds) */
    when:      m.actual_time ?? m.predicted_time ?? m.time,
  } as const;
}
