// An event from our side: where to watch, our next match, how we're doing, and every match we
// played. Used by a linked competition's page and by past events in the team's history. Server-safe.

import { links } from "@/lib/frc/links";
import type { EventLive } from "@/lib/frc/event-live";
import { BumperChip, matchTime, ResultChip } from "./parts";

const RED = "#DC2626", BLUE = "#2563EB";

export function EventDetails({ live, tz, when }: { live: EventLive; tz: string; when: "before" | "live" | "after" }) {
  const status = live.status;
  const rank = status?.qual?.ranking;
  const next = when === "after" ? null : live.next;

  return (
    <>
      {/* The livestream, front and center while the event is on */}
      {when !== "after" && live.streams.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {live.streams.map((s) => (
            <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-md bg-(--color-danger) px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
              <span aria-hidden>▶</span> {when === "live" ? "Watch live" : "Livestream"} on {s.label}
            </a>
          ))}
        </div>
      )}

      {(status || next) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {next && (
            <section className="card space-y-2 border-l-4" style={{ borderLeftColor: next.color === "red" ? RED : BLUE }}>
              <p className="text-small text-(--color-text-secondary)">Our next match</p>
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-h2 text-(--color-text-primary)">{next.label}</span>
                <BumperChip color={next.color} />
              </div>
              {next.when && <p className="text-sm text-(--color-text-primary)">About {matchTime(next.when, tz)}</p>}
              <p className="text-small text-(--color-text-secondary)">
                With {next.partners.join(" & ") || "—"} · against {next.opponents.join(", ") || "—"}
              </p>
              <a href={links.match13Match(next.key)} target="_blank" rel="noopener noreferrer" className="text-small text-(--color-secondary) hover:underline">
                Prediction on Match13 ↗
              </a>
            </section>
          )}
          {status && (
            <section className="card space-y-1">
              <p className="text-small text-(--color-text-secondary)">{when === "after" ? "How we did" : "How we're doing"}</p>
              {rank?.rank != null && (
                <p className="text-h2 text-(--color-text-primary)">
                  Rank {rank.rank}{status.qual?.num_teams ? <span className="text-sm font-normal text-(--color-text-secondary)"> of {status.qual.num_teams}</span> : null}
                </p>
              )}
              {rank?.record && <p className="text-sm text-(--color-text-primary)">{rank.record.wins}–{rank.record.losses}–{rank.record.ties} (wins–losses–ties)</p>}
              {status.alliance && <p className="text-sm text-(--color-text-primary)">{status.alliance.name ?? `Alliance ${status.alliance.number}`} — {status.alliance.pick === 0 ? "captain" : `pick ${status.alliance.pick}`}</p>}
              {status.overall_status_str && <p className="text-small text-(--color-text-secondary)">{status.overall_status_str}</p>}
            </section>
          )}
        </div>
      )}

      <section className="card p-0 overflow-hidden">
        <h2 className="text-h3 text-(--color-text-primary) px-4 pt-4 pb-2">Our matches</h2>
        {live.matches.length === 0 ? (
          <p className="px-4 pb-4 text-small text-(--color-text-secondary)">
            {when === "after" ? "No matches recorded." : "The match schedule isn't out yet — it's usually posted the evening before or the morning of the first match day."}
          </p>
        ) : (
          <ul className="divide-y divide-(--color-border)">
            {live.matches.map((m) => (
              <li key={m.key} className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2.5 ${next?.key === m.key ? "bg-(--color-primary)/5" : ""}`}>
                <div className="flex min-w-0 items-center gap-3">
                  <span className="w-1.5 self-stretch rounded" style={{ backgroundColor: m.color === "red" ? RED : BLUE }} aria-hidden />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-(--color-text-primary)">
                      {m.label} <span className="sr-only">({m.color})</span>
                      {next?.key === m.key && <span className="ml-2 text-xs font-semibold text-(--color-primary)">Next</span>}
                    </p>
                    <p className="text-small text-(--color-text-secondary)">
                      {m.result == null && m.when ? `${matchTime(m.when, tz)} · ` : ""}with {m.partners.join(" & ")} · vs {m.opponents.join(", ")}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {m.result && <span className="text-sm tabular-nums text-(--color-text-primary)">{m.ourScore}–{m.theirScore}</span>}
                  <ResultChip result={m.result} />
                  {m.video && (
                    <a href={m.video} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-small font-medium text-(--color-danger) hover:underline">
                      <span aria-hidden>▶</span> Video
                    </a>
                  )}
                  <a href={links.match13Match(m.key)} target="_blank" rel="noopener noreferrer" className="text-small text-(--color-secondary) hover:underline">Match13</a>
                  <a href={links.tbaMatch(m.key)} target="_blank" rel="noopener noreferrer" className="text-small text-(--color-secondary) hover:underline">TBA</a>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
