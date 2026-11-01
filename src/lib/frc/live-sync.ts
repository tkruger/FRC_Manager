// Live competition notifications. For each competition happening now that's linked to its event,
// compares The Blue Alliance (and Nexus, when set up) with what the team has already been told,
// and notifies everyone about what's new: the schedule, our next match, results, alliance
// selection and playoffs, and awards. Each notice is sent once — its key is claimed in
// ReminderLog before sending, so the 5-minute job and the webhooks can't both send it.
// Server-only.

import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { notifyRoles, type OutgoingNotification } from "@/lib/notify/deliver";
import { FALLBACK_TIMEZONE, isValidTimezone, localParts } from "@/lib/notify/time";
import { teamEventAwards, tbaConfigured } from "./tba";
import { eventWindow, loadEventLive, matchTime, type OurMatch } from "./event-live";
import { nexusEventStatus, nexusSide, shortLabel } from "./nexus";

/** Heads-up this long before a match (when Nexus isn't calling queues) */
const SOON_S = 20 * 60;
/** Results posted longer ago than this aren't announced (e.g. a competition linked mid-event) */
const RESULT_WINDOW_S = 45 * 60;

const bumpers = (c: "red" | "blue") => (c === "red" ? "🔴 red bumpers" : "🔵 blue bumpers");
const teams = (m: OurMatch) => `With ${m.partners.join(" & ") || "—"} · vs ${m.opponents.join(", ") || "—"}`;
const PICKS = ["captain", "first pick", "second pick", "backup"];
const LEVELS: Record<string, string> = { qf: "quarterfinals", sf: "playoffs", f: "finals", ef: "eighthfinals" };

/** Claim a notice; false if it was already sent */
async function claim(key: string): Promise<boolean> {
  // Insert-if-absent: only one caller gets count 1
  const { count } = await prisma.reminderLog.createMany({ data: [{ key, lastSentAt: new Date() }], skipDuplicates: true });
  return count === 1;
}

interface Comp {
  id: string; name: string; tbaEventKey: string; startDate: Date; endDate: Date;
  teamId: string; teamNumber: number; timezone: string;
}

/** Check one competition and send what's new. Returns how many notices went out. */
export async function syncCompetition(c: Comp): Promise<number> {
  const live = await loadEventLive(c.teamNumber, c.tbaEventKey, true);
  const tz = isValidTimezone(live.event?.timezone) ? live.event!.timezone! : c.timezone;
  const url = `/competitions/${c.id}`;
  const p = `fl:${c.id}`;
  const now = Date.now() / 1000;
  let sent = 0;
  const send = async (key: string, n: Omit<OutgoingNotification, "type" | "url">) => {
    if (!(await claim(`${p}:${key}`))) return;
    await notifyRoles(c.teamId, "all", { ...n, type: "COMPETITION_LIVE", url });
    sent++;
  };

  // ── The qualification schedule: posted, then any change to our matches ──
  const quals = live.matches.filter((m) => !m.playoff);
  if (quals.length > 0) {
    const sig = createHash("sha256")
      .update(quals.map((m) => `${m.key}:${m.color}:${m.partners.join(",")}:${m.opponents.join(",")}`).join("|"))
      .digest("hex").slice(0, 16);
    const before = await prisma.reminderLog.findFirst({ where: { key: { startsWith: `${p}:sched:` } }, select: { key: true } });
    const first = quals.find((m) => m.result == null);
    await send(`sched:${sig}`, {
      topic: "competitions.schedule",
      title: before ? `📋 Our match schedule changed — ${c.name}` : `📋 The match schedule is out — ${c.name}`,
      body: `${quals.length} qualification match${quals.length === 1 ? "" : "es"}.` +
        (first ? ` ${before ? "Next" : "First"}: ${first.label}${first.when ? ` · ${matchTime(first.when, tz)}` : ""} · ${bumpers(first.color)}.` : ""),
      tag: `${p}-sched`,
    });
  }

  // ── Our next match: Nexus queuing calls, else a heads-up from TBA's predicted time ──
  const nexus = await nexusEventStatus(c.tbaEventKey);
  const nexusOurs = (nexus?.matches ?? []).filter((m) => nexusSide(m, c.teamNumber));
  for (const m of nexusOurs) {
    if (m.status !== "Now queuing") continue;
    const color = nexusSide(m, c.teamNumber)!;
    const start = m.times?.estimatedStartTime ? Math.round((m.times.estimatedStartTime / 1000 - now) / 60) : null;
    await send(`queue:${m.label}`, {
      topic: "competitions.next_match",
      title: `🤖 Now queuing: ${shortLabel(m.label)} — ${bumpers(color)}`,
      body: `Our robot is heading to the field${start != null && start > 0 ? ` — the match is in about ${start} minutes` : ""}.`,
      tag: `${p}-next`, ttl: 30 * 60,
    });
  }
  // Without Nexus at this event, TBA's predicted times give the heads-up
  if (nexusOurs.length === 0) {
    for (const m of live.matches) {
      if (m.result != null || m.when == null || m.when < now || m.when - now > SOON_S) continue;
      await send(`soon:${m.key}`, {
        topic: "competitions.next_match",
        title: `⏱️ ${m.label} in about ${Math.max(1, Math.round((m.when - now) / 60))} minutes — ${bumpers(m.color)}`,
        body: teams(m),
        tag: `${p}-next`, ttl: 30 * 60,
      });
    }
  }

  // ── Results (just posted) ──
  const rank = live.status?.qual?.ranking;
  for (const m of live.matches) {
    if (m.result == null) continue;
    const at = m.postedAt ?? m.when;
    if (at == null || now - at > RESULT_WINDOW_S) continue;
    const verb = m.result === "win" ? "Won" : m.result === "loss" ? "Lost" : "Tied";
    const standing = !m.playoff && rank?.rank != null
      ? `Now ranked ${rank.rank}${live.status?.qual?.num_teams ? ` of ${live.status.qual.num_teams}` : ""}${rank.record ? ` (${rank.record.wins}–${rank.record.losses}–${rank.record.ties})` : ""}.`
      : "";
    await send(`result:${m.key}`, {
      topic: "competitions.results",
      title: `${m.result === "win" ? "🎉" : m.result === "loss" ? "😬" : "🤝"} ${verb} ${m.label}, ${m.ourScore}–${m.theirScore}`,
      body: [standing, teams(m) + "."].filter(Boolean).join(" "),
      tag: `${p}-result`,
    });
  }

  // ── Alliance selection and playoffs ──
  const alliance = live.status?.alliance;
  if (alliance) {
    const name = alliance.name ?? `Alliance ${alliance.number}`;
    await send("alliance", {
      topic: "competitions.playoffs",
      title: alliance.pick === 0 ? `🤝 We're the captain of ${name}!` : `🤝 We're on ${name} for the playoffs!`,
      body: alliance.pick === 0 ? "We picked our partners for the playoffs." : `Picked as the ${PICKS[alliance.pick] ?? "backup"}.`,
    });
  }
  const playoff = live.status?.playoff;
  if (playoff?.status === "won" && playoff.level === "f") {
    await send("playoff:won", { topic: "competitions.playoffs", title: `🏆 We won ${c.name}!`, body: "Event winners — congratulations, team!" });
  } else if (playoff?.status === "eliminated") {
    const rec = playoff.record ? ` (${playoff.record.wins}–${playoff.record.losses}${playoff.record.ties ? `–${playoff.record.ties}` : ""})` : "";
    await send("playoff:out", {
      topic: "competitions.playoffs",
      title: `Our playoff run ended in the ${LEVELS[playoff.level] ?? "playoffs"}`,
      body: `Great effort at ${c.name}${rec}.`,
    });
  }

  // ── Awards ──
  const awards = await teamEventAwards(c.teamNumber, c.tbaEventKey, true);
  for (const a of awards ?? []) {
    await send(`award:${a.award_type}:${a.name}`, { topic: "competitions.awards", title: `🏅 We won the ${a.name}!`, body: `At ${c.name}.` });
  }

  return sent;
}

/** Every competition happening now (optionally just one event's), checked for news */
export async function syncLiveCompetitions(opts: { eventKey?: string } = {}): Promise<{ checked: number; sent: number }> {
  if (!tbaConfigured()) return { checked: 0, sent: 0 };
  const now = new Date();
  // A day either side in UTC, narrowed to "today" in each team's time zone below
  const comps = await prisma.competitionEvent.findMany({
    where: {
      tbaEventKey: opts.eventKey ? opts.eventKey : { not: null },
      startDate: { lte: new Date(now.getTime() + 86_400_000) },
      endDate:   { gte: new Date(now.getTime() - 2 * 86_400_000) },
    },
    select: {
      id: true, name: true, tbaEventKey: true, startDate: true, endDate: true,
      season: { select: { team: { select: { id: true, teamNumber: true, timezone: true } } } },
    },
  });

  let checked = 0, sent = 0;
  for (const c of comps) {
    const team = c.season.team;
    const timezone = isValidTimezone(team.timezone) ? team.timezone! : FALLBACK_TIMEZONE;
    if (eventWindow(localParts(now, timezone).dateKey, c.startDate, c.endDate) !== "live") continue;
    checked++;
    sent += await syncCompetition({
      id: c.id, name: c.name, tbaEventKey: c.tbaEventKey!, startDate: c.startDate, endDate: c.endDate,
      teamId: team.id, teamNumber: team.teamNumber, timezone,
    }).catch((e) => { console.error("[live-sync]", c.id, e); return 0; });
  }
  return { checked, sent };
}
