// Pieces of the competition pages and home tile. Server-safe (no hooks).

import { links, TBA_APP_ANDROID, TBA_APP_IOS } from "@/lib/frc/links";
export { matchTime } from "@/lib/frc/event-live";

/** "Red bumpers" / "Blue bumpers" — which side we're on, so people know who to cheer for */
export function BumperChip({ color, size = "md" }: { color: "red" | "blue"; size?: "sm" | "md" }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold text-white ${size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm"}`}
      style={{ backgroundColor: color === "red" ? "#DC2626" : "#2563EB" }}
    >
      {color === "red" ? "Red" : "Blue"} bumpers
    </span>
  );
}

export function ResultChip({ result }: { result: "win" | "loss" | "tie" | null }) {
  if (!result) return null;
  const style = { win: "bg-(--color-success)/15 text-(--color-success)", loss: "bg-(--color-danger)/15 text-(--color-danger)", tie: "bg-(--color-surface-overlay) text-(--color-text-secondary)" }[result];
  return <span className={`rounded px-1.5 py-0.5 text-xs font-bold uppercase ${style}`}>{result === "win" ? "W" : result === "loss" ? "L" : "T"}</span>;
}

type FollowLink = { label: string; href: string; desc: string };

/** The sites and apps to follow an event on — mostly for parents new to FRC */
export function FollowAlong({ team, eventKey, year, streams }: { team: number; eventKey: string | null; year: number; streams: { url: string; label: string }[] }) {
  const items: FollowLink[] = [
    ...streams.map((s, i) => ({ label: `Watch on ${s.label}${streams.length > 1 ? ` (${i + 1})` : ""}`, href: s.url, desc: "The event's livestream — and its recording afterward" })),
    ...(eventKey ? [
      { label: "Queue & pit times — Nexus", href: links.nexusEvent(eventKey), desc: "When our robot is called to queue, live from the field" },
      { label: "Schedule & results — The Blue Alliance", href: links.tbaEvent(eventKey), desc: "Every match, score and ranking at this event" },
      { label: "Rankings & predictions — Match13", href: links.match13Event(eventKey), desc: "Team rankings and who's likely to win each match" },
      { label: "Official results — FIRST", href: links.firstEvent(eventKey), desc: "FIRST's own schedule and rankings" },
    ] : []),
    { label: `Team ${team} on The Blue Alliance`, href: links.tbaTeam(team, year), desc: "Our season: every event, match and award" },
    { label: `Team ${team} on Match13`, href: links.match13Team(team, year), desc: "How we rank this season" },
  ];
  return (
    <section className="card space-y-3">
      <h2 className="text-h3 text-(--color-text-primary)">Follow along</h2>
      <ul className="grid gap-2 sm:grid-cols-2">
        {items.map((l) => (
          <li key={l.href}>
            <a href={l.href} target="_blank" rel="noopener noreferrer"
              className="block h-full rounded-md border border-(--color-border) px-3 py-2.5 hover:border-(--color-primary) hover:bg-(--color-surface-overlay)">
              <span className="block text-sm font-medium text-(--color-secondary)">{l.label} ↗</span>
              <span className="block text-small text-(--color-text-secondary)">{l.desc}</span>
            </a>
          </li>
        ))}
      </ul>
      <p className="text-small text-(--color-text-secondary)">
        On your phone, The Blue Alliance app can alert you before each of our matches:{" "}
        <a href={TBA_APP_IOS} target="_blank" rel="noopener noreferrer" className="text-(--color-secondary) hover:underline">iPhone</a>
        {" · "}
        <a href={TBA_APP_ANDROID} target="_blank" rel="noopener noreferrer" className="text-(--color-secondary) hover:underline">Android</a>
        {" "}— add team {team} to your favorites.
      </p>
    </section>
  );
}

/** What happens at an FRC event, in plain words */
export function EventExplainer({ team }: { team: number }) {
  return (
    <details className="card group">
      <summary className="cursor-pointer list-none text-h3 text-(--color-text-primary) flex items-center justify-between gap-2">
        New to FRC competitions? Start here
        <span className="text-small text-(--color-text-secondary) group-open:hidden">Show</span>
        <span className="text-small text-(--color-text-secondary) hidden group-open:inline">Hide</span>
      </summary>
      <div className="mt-3 space-y-3 text-sm text-(--color-text-primary)">
        <p>
          <b>Matches are three robots against three.</b> Each match puts six teams on the field: a red alliance and a blue alliance. The
          robot&apos;s <b>bumper color</b> shows which side it&apos;s on, so look for team {team} on red or blue — the color changes from
          match to match.
        </p>
        <p>
          <b>Qualification matches</b> (&quot;Qual 14&quot;) fill the first days. Partners and opponents are random and change every
          match. Teams earn <b>ranking points</b> for winning and for bonus goals, and the rankings update after each match.
        </p>
        <p>
          <b>Alliance selection</b> comes after the last qualification match. The top eight teams become captains and each picks two
          partners — so a good ranking, or a robot other teams want, keeps us playing.
        </p>
        <p>
          <b>Playoffs</b> are double elimination: an alliance is out after losing twice. The alliance that wins the finals (best of
          three) wins the event. <b>Awards</b> are given out along the way and at the closing ceremony — many are for the team, not
          the robot.
        </p>
        <p>
          <b>Queuing</b>: about three matches before ours, the drive team takes the robot to the queue next to the field. The Nexus page
          shows when we&apos;re called, and it&apos;s the best time to head to your seat. Schedules often run a little early or late —
          the times here are the field&apos;s latest estimate.
        </p>
        <p className="text-(--color-text-secondary)">
          Tip: events are loud. Ear plugs, a water bottle and a team shirt go a long way.
        </p>
      </div>
    </details>
  );
}
