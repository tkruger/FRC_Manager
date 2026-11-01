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
      // 0: straight from TBA (the live-update job, which must see changes as they happen)
      ...(revalidate === 0 ? { cache: "no-store" as const } : { next: { revalidate } }),
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

export interface TbaTeam { key: string; team_number: number; nickname: string | null; name: string | null; city: string | null; state_prov: string | null; rookie_year: number | null }

/** Past seasons don't change: cache them for a day */
const yearCache = (year: number) => (year < new Date().getFullYear() ? 86_400 : 3600);

export const teamInfo = (n: number) => tba<TbaTeam>(`/team/${teamKey(n)}`, 86_400);

/** Every season the team competed in */
export const yearsParticipated = (n: number) => tba<number[]>(`/team/${teamKey(n)}/years_participated`, 86_400);

/** Every award the team has won */
export const teamAwards = (n: number) => tba<TbaAward[]>(`/team/${teamKey(n)}/awards`, 21_600);

/** The team's result at each event in a season, by event key */
export const teamEventStatuses = (n: number, year: number) =>
  tba<Record<string, TbaTeamEventStatus | null>>(`/team/${teamKey(n)}/events/${year}/statuses`, yearCache(year));

/** The team's events in a season */
export const teamEvents = (team: number, year: number) =>
  tba<TbaEvent[]>(`/team/${teamKey(team)}/events/${year}`, yearCache(year));

export const event = (eventKey: string) => tba<TbaEvent>(`/event/${eventKey}`, 1800);

/** The team's matches at an event (the schedule, then scores as they're played) */
export const teamEventMatches = (team: number, eventKey: string, fresh = false) =>
  tba<TbaMatch[]>(`/team/${teamKey(team)}/event/${eventKey}/matches`, fresh ? 0 : 60);

export interface TbaAward { name: string; award_type: number; event_key: string; year: number; recipient_list: { team_key: string | null; awardee: string | null }[] }

/** Awards the team won at an event */
export const teamEventAwards = (team: number, eventKey: string, fresh = false) =>
  tba<TbaAward[]>(`/team/${teamKey(team)}/event/${eventKey}/awards`, fresh ? 0 : 300);

export async function teamEventStatus(team: number, eventKey: string, fresh = false): Promise<TbaTeamEventStatus | null> {
  const s = await tba<TbaTeamEventStatus>(`/team/${teamKey(team)}/event/${eventKey}/status`, fresh ? 0 : 60);
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

/** Where to watch a webcast, and on what */
export function webcastLink(w: TbaWebcast): { url: string; label: string } | null {
  const url = webcastUrl(w);
  if (!url) return null;
  return { url, label: w.type === "youtube" ? "YouTube" : w.type === "twitch" ? "Twitch" : "the stream" };
}

/** A match's video (TBA lists YouTube uploads; the key may carry a start time like "abc?t=42") */
export function matchVideoUrl(m: Pick<TbaMatch, "videos">): string | null {
  const v = m.videos?.find((x) => x.type === "youtube" && x.key);
  if (!v) return null;
  const [id, query] = v.key.split("?");
  return `https://www.youtube.com/watch?v=${encodeURIComponent(id)}${query ? `&${query}` : ""}`;
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

/** One line on how an event went for us: "🏆 Event winner", "Alliance 3 captain · Rank 2 of 40" */
export function eventResultSummary(s: TbaTeamEventStatus | null | undefined): string | null {
  if (!s) return null;
  const parts: string[] = [];
  if (s.playoff?.status === "won" && s.playoff.level === "f") parts.push("🏆 Event winner");
  else if (s.playoff?.status === "eliminated" && s.playoff.level === "f") parts.push("Finalist");
  if (s.alliance) parts.push(`${s.alliance.name ?? `Alliance ${s.alliance.number}`} ${s.alliance.pick === 0 ? "captain" : `pick ${s.alliance.pick}`}`);
  const r = s.qual?.ranking;
  if (r?.rank != null) parts.push(`Rank ${r.rank}${s.qual?.num_teams ? ` of ${s.qual.num_teams}` : ""}`);
  if (r?.record) parts.push(`${r.record.wins}–${r.record.losses}–${r.record.ties}`);
  return parts.length ? parts.join(" · ") : null;
}
