// A competition's live picture for our team: the event, our matches (with our side of each),
// our rank and record, and the next match. Server-only — needs TBA_API_KEY for anything but links.

import { event, matchLabel, ourSide, sortMatches, teamEventMatches, teamEventStatus, webcastUrl, type TbaEvent, type TbaTeamEventStatus } from "./tba";

export interface OurMatch {
  key: string;
  label: string;
  color: "red" | "blue";
  partners: number[];
  opponents: number[];
  ourScore: number | null;
  theirScore: number | null;
  result: "win" | "loss" | "tie" | null;
  /** Best guess of when it starts (Unix seconds) */
  when: number | null;
  /** Scheduled, before any delay (Unix seconds) */
  scheduled: number | null;
  playoff: boolean;
}

export interface EventLive {
  event: TbaEvent | null;
  matches: OurMatch[];
  status: TbaTeamEventStatus | null;
  next: OurMatch | null;
  /** Where to watch, if the event lists a stream */
  streams: string[];
}

export async function loadEventLive(team: number, eventKey: string): Promise<EventLive> {
  const [ev, list, status] = await Promise.all([event(eventKey), teamEventMatches(team, eventKey), teamEventStatus(team, eventKey)]);
  const year = Number(eventKey.slice(0, 4));
  const matches: OurMatch[] = sortMatches(list ?? []).map((m) => {
    const s = ourSide(m, team);
    return {
      key: m.key, label: matchLabel(m, year), color: s.color, partners: [...s.partners], opponents: [...s.opponents],
      ourScore: s.ourScore, theirScore: s.theirScore, result: s.result, when: s.when, scheduled: m.time,
      playoff: m.comp_level !== "qm",
    };
  });
  const next = (status?.next_match_key && matches.find((m) => m.key === status.next_match_key)) || matches.find((m) => m.result == null) || null;
  const streams = [...new Set((ev?.webcasts ?? []).map(webcastUrl).filter((u): u is string => !!u))];
  return { event: ev, matches, status, next, streams };
}

/** Is the event on now (or within a day of either end), by calendar days in the team's time zone? */
export function eventWindow(todayKey: string, start: Date, end: Date): "before" | "live" | "after" {
  const day = (d: Date) => d.toISOString().slice(0, 10);
  if (todayKey < day(start)) return "before";
  if (todayKey > day(end)) return "after";
  return "live";
}
