// A competition's live picture for our team: the event, our matches (with our side of each),
// our rank and record, and the next match. Server-only — needs TBA_API_KEY for anything but links.

import { event, matchLabel, matchVideoUrl, ourSide, sortMatches, teamEventMatches, teamEventStatus, webcastLink, type TbaEvent, type TbaTeamEventStatus } from "./tba";

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
  /** When the score was posted (Unix seconds) */
  postedAt: number | null;
  /** The match's video on YouTube, once it's uploaded */
  video: string | null;
  playoff: boolean;
}

export interface EventLive {
  event: TbaEvent | null;
  matches: OurMatch[];
  status: TbaTeamEventStatus | null;
  next: OurMatch | null;
  /** Where to watch, if the event lists a stream (YouTube, Twitch …) */
  streams: { url: string; label: string }[];
}

/** fresh: skip the short cache (the live-update job) */
export async function loadEventLive(team: number, eventKey: string, fresh = false): Promise<EventLive> {
  const [ev, list, status] = await Promise.all([event(eventKey), teamEventMatches(team, eventKey, fresh), teamEventStatus(team, eventKey, fresh)]);
  const year = Number(eventKey.slice(0, 4));
  const matches: OurMatch[] = sortMatches(list ?? []).map((m) => {
    const s = ourSide(m, team);
    return {
      key: m.key, label: matchLabel(m, year), color: s.color, partners: [...s.partners], opponents: [...s.opponents],
      ourScore: s.ourScore, theirScore: s.theirScore, result: s.result, when: s.when, scheduled: m.time, postedAt: m.post_result_time, video: matchVideoUrl(m),
      playoff: m.comp_level !== "qm",
    };
  });
  const next = (status?.next_match_key && matches.find((m) => m.key === status.next_match_key)) || matches.find((m) => m.result == null) || null;
  const streams = (ev?.webcasts ?? []).map(webcastLink).filter((w): w is { url: string; label: string } => !!w)
    .filter((w, i, all) => all.findIndex((x) => x.url === w.url) === i);
  return { event: ev, matches, status, next, streams };
}

/** Unix seconds → "Sat 10:42 AM", in the event's time zone */
export function matchTime(unix: number | null, tz: string): string | null {
  if (unix == null) return null;
  return new Date(unix * 1000).toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit", timeZone: tz });
}

/** Is the event on now (or within a day of either end), by calendar days in the team's time zone? */
export function eventWindow(todayKey: string, start: Date, end: Date): "before" | "live" | "after" {
  const day = (d: Date) => d.toISOString().slice(0, 10);
  if (todayKey < day(start)) return "before";
  if (todayKey > day(end)) return "after";
  return "live";
}
