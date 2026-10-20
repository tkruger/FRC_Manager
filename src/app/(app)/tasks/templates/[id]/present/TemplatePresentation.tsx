"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  buildTimeline, templateChecks, PHASES,
  type Timeline, type TimelineItem, type TimelineMarker, type TimelineSeason, type TimelineTask,
} from "@/lib/template-timeline";
import { SUBTEAM_OPTIONS, SUBTEAM_COLORS } from "@/lib/schedule-helpers";

// Slides are laid out on a fixed 1600×900 (16:9) canvas and scaled to fit the screen,
// letterboxed on black — like a slide deck's presentation mode. Light slides read best on
// projectors whatever the app's theme is, so colors here are fixed.

const W = 1600;
const H = 900;
const PAD = 64;
const LABEL_W = 400;
const CHART_W = W - PAD * 2 - LABEL_W;
// Gantt slides use smaller text and margins so the chart gets most of the slide
const G_PAD = 36;
const G_LABEL_W = 300;
const G_ROW_W = W - G_PAD * 2;
const G_CHART_W = G_ROW_W - G_LABEL_W;

const C = {
  bg: "#ffffff", text: "#0f172a", muted: "#64748b", faint: "#94a3b8", grid: "#e2e8f0", band: "#f8fafc",
  accent: "#C1121F", secondary: "#1D3A8A", ok: "#16a34a", warn: "#d97706",
  /** Milestones are dark diamonds — no sub-team uses that color */
  milestone: "#0f172a",
};

// The same sub-team colors as the rest of the app (task board, Gantt, calendar)
const teamColor = (t: string | null) => (t ? SUBTEAM_COLORS[t] ?? "#64748b" : "#94a3b8");
const teamLabel = (t: string | null) => SUBTEAM_OPTIONS.find((o) => o.value === t)?.label ?? "No sub-team";

const DAY = 86_400_000;

/** Labels for a day on the timeline: real dates when there's a season, else weeks from kickoff */
function makeLabels(kickoff: string | null) {
  const k = kickoff ? new Date(kickoff).getTime() : null;
  const fmt = (day: number, opts: Intl.DateTimeFormatOptions) =>
    new Date(k! + day * DAY).toLocaleDateString("en-US", { ...opts, timeZone: "UTC" });
  return {
    date: (day: number) => (k != null ? fmt(day, { month: "short", day: "numeric" }) : day === 0 ? "Kickoff" : `${day > 0 ? "Day " : "Day −"}${Math.abs(day)}`),
    long: (day: number) => (k != null ? fmt(day, { weekday: "short", month: "short", day: "numeric" }) : day === 0 ? "Kickoff" : `${Math.abs(day)} days ${day > 0 ? "after" : "before"} kickoff`),
    tick: (day: number) => (k != null ? fmt(day, { month: "short", day: "numeric" }) : day === 0 ? "Kickoff" : `${day > 0 ? "+" : "−"}${Math.abs(day / 7)}w`),
    /** Day of the week (0 = Sunday … 6 = Saturday), when the dates are known */
    weekday: (day: number) => (k != null ? new Date(k + day * DAY).getUTCDay() : null),
  };
}
type Labels = ReturnType<typeof makeLabels>;

function rangeOf(items: TimelineItem[], pad = 3): [number, number] {
  if (items.length === 0) return [0, 56];
  const lo = Math.min(...items.map((i) => i.start));
  const hi = Math.max(...items.map((i) => i.due));
  return [Math.min(lo, hi - 7) - pad, Math.max(hi, lo + 7) + pad];
}

// ── Building blocks ─────────────────────────────────────────────────────────

/** `compact` (Gantt slides): a one-line title and small margins, leaving the room to the chart */
function Slide({ title, kicker, children, footer, compact = false }: { title?: string; kicker?: string; children: React.ReactNode; footer?: React.ReactNode; compact?: boolean }) {
  return (
    <div style={{ position: "relative", width: W, height: H, background: C.bg, color: C.text, padding: compact ? `28px ${G_PAD}px` : PAD, display: "flex", flexDirection: "column", fontFamily: "var(--font-inter), system-ui, sans-serif" }}>
      {title && (
        <div style={{ marginBottom: compact ? 12 : 28, ...(compact ? { display: "flex", alignItems: "baseline", gap: 14 } : {}) }}>
          {kicker && <div style={{ fontSize: compact ? 14 : 22, fontWeight: 600, color: C.accent, letterSpacing: 0.5, textTransform: "uppercase", ...(compact ? { order: 1 } : {}) }}>{kicker}</div>}
          <div style={{ fontSize: compact ? 28 : 52, fontWeight: 800, lineHeight: 1.1 }}>{title}</div>
        </div>
      )}
      <div style={{ flex: 1, minHeight: 0, position: "relative" }}>{children}</div>
      {footer && <div style={{ marginTop: compact ? 8 : 16, fontSize: compact ? 13 : 18, color: C.muted }}>{footer}</div>}
      <div style={{ position: "absolute", right: 24, bottom: 14, fontSize: 14, color: C.faint }}>Example dates for illustration</div>
    </div>
  );
}

/** Which color is which sub-team — only the ones this template uses */
function TeamKey({ teams, size = 18 }: { teams: (string | null)[]; size?: number }) {
  return (
    <span style={{ display: "inline-flex", flexWrap: "wrap", gap: "6px 22px", fontSize: size }}>
      {teams.map((t) => (
        <span key={t ?? "none"} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: size * 0.7, height: size * 0.7, borderRadius: size, background: teamColor(t) }} />
          {teamLabel(t)}
        </span>
      ))}
    </span>
  );
}

function Legend({ estimated }: { estimated: boolean }) {
  const item = (el: React.ReactNode, text: string) => (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, marginRight: 22 }}>{el}{text}</span>
  );
  return (
    <span>
      {item(<span style={{ width: 28, height: 9, borderRadius: 5, background: C.secondary, display: "inline-block" }} />, "Task: start → due")}
      {item(<span style={{ width: 9, height: 9, background: C.milestone, transform: "rotate(45deg)", display: "inline-block" }} />, "Milestone")}
      {item(<span style={{ width: 0, height: 14, borderLeft: `2px solid ${C.faint}`, display: "inline-block" }} />, "Key dates")}
      {estimated && item(<span style={{ width: 28, height: 9, borderRadius: 5, border: `2px dashed ${C.secondary}`, display: "inline-block" }} />, "Estimated (not in the season yet)")}
    </span>
  );
}

function ticksFor(lo: number, hi: number): number[] {
  const span = hi - lo;
  const step = span <= 70 ? 7 : span <= 200 ? 14 : 28;
  const out: number[] = [];
  for (let d = Math.ceil(lo / step) * step; d <= hi; d += step) out.push(d);
  return out;
}

/** A Gantt chart: one row per item, bars from start to due, milestones as diamonds */
function Gantt({ items, range, markers, labels, height }: {
  items: TimelineItem[]; range: [number, number]; markers: TimelineMarker[]; labels: Labels; height: number;
}) {
  const [lo, hi] = range;
  const x = (d: number) => ((d - lo) / (hi - lo)) * G_CHART_W;
  const shown = markers.filter((m) => m.day >= lo && m.day <= hi);
  // The row under the mouse (for its hover card) and how far the rows are scrolled
  const [hover, setHover] = useState<number | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  // Key-date labels get their own band under the date ticks; labels too close to the one
  // before drop to a second line so they never overlap
  const markerRow: number[] = [];
  const lastX = [-Infinity, -Infinity, -Infinity, -Infinity];
  for (const m of shown) {
    const mx = x(m.day);
    const free = lastX.findIndex((lx) => mx - lx >= 10 + m.label.length * 7);
    const row = free === -1 ? lastX.indexOf(Math.min(...lastX)) : free;
    markerRow.push(row);
    lastX[row] = mx;
  }
  const markerRows = shown.length ? Math.max(...markerRow) + 1 : 0;
  const tickH = 22;
  const axisH = tickH + markerRows * 17 + 6;
  // Rows keep a readable height; when they don't all fit, the rows scroll under the
  // date header (which stays put) instead of spilling onto another slide
  const viewH = height - axisH;
  const rowH = Math.max(26, Math.min(32, Math.floor(viewH / Math.max(1, items.length))));
  const scrolls = items.length * rowH > viewH;
  // Room at the end so the last row clears the fade
  const innerH = Math.max(viewH, items.length * rowH + (scrolls ? 36 : 0));
  const font = 15;

  // Day ticks along the bottom of each row, with a taller tick where each week starts
  // (weeks counted from kickoff, matching the date axis). Drawn as repeating gradients so
  // long ranges stay cheap; day ticks are left out when days get too narrow to see.
  const dayW = G_CHART_W / (hi - lo);
  const firstDay = Math.ceil(lo);
  const firstWeek = Math.ceil(lo / 7) * 7;
  // Weekends (Saturday + Sunday) get a light shade — kickoff and competitions fall on them
  let firstSat: number | null = null;
  for (let d = Math.ceil(lo) - 7; d <= Math.ceil(lo); d++) if (labels.weekday(d) === 6) firstSat = d;
  const weekends: React.CSSProperties | null = firstSat == null ? null : {
    position: "absolute", inset: 0, pointerEvents: "none",
    backgroundImage: `repeating-linear-gradient(to right, rgba(15,23,42,.05) 0 ${dayW * 2}px, transparent ${dayW * 2}px ${dayW * 7}px)`,
    backgroundPositionX: x(firstSat),
  };
  const dayTicks: React.CSSProperties = {
    position: "absolute", left: 0, right: 0, bottom: 0, height: 5, pointerEvents: "none",
    backgroundImage: `repeating-linear-gradient(to right, ${C.faint} 0 1px, transparent 1px ${dayW}px)`,
    backgroundPositionX: x(firstDay),
  };
  const weekTicks: React.CSSProperties = {
    position: "absolute", left: 0, right: 0, bottom: 0, height: 10, pointerEvents: "none",
    backgroundImage: `repeating-linear-gradient(to right, ${C.muted} 0 1.5px, transparent 1.5px ${dayW * 7}px)`,
    backgroundPositionX: x(firstWeek),
  };

  return (
    <div style={{ position: "relative", height }}>
      {/* Date ticks */}
      <div style={{ position: "absolute", left: G_LABEL_W, top: 0, width: G_CHART_W, height: axisH, borderBottom: `2px solid ${C.grid}` }}>
        {ticksFor(lo, hi).map((d) => (
          <div key={d} style={{ position: "absolute", left: x(d), top: 3, transform: "translateX(-50%)", fontSize: 13, color: C.muted, whiteSpace: "nowrap" }}>{labels.tick(d)}</div>
        ))}
        {/* Key-date labels */}
        {shown.map((m, i) => (
          <div key={`${m.label}-${i}`} style={{ position: "absolute", left: x(m.day), top: tickH + markerRow[i] * 17, transform: x(m.day) > G_CHART_W - 120 ? "translateX(-100%)" : "translateX(-2px)", fontSize: 12, fontWeight: 700, color: m.kind === "week0" ? C.accent : C.secondary, whiteSpace: "nowrap", padding: "0 4px", borderLeft: x(m.day) > G_CHART_W - 120 ? "none" : `2px ${m.estimated ? "dashed" : "solid"} ${m.kind === "week0" ? C.accent : C.faint}`, borderRight: x(m.day) > G_CHART_W - 120 ? `2px ${m.estimated ? "dashed" : "solid"} ${m.kind === "week0" ? C.accent : C.faint}` : "none" }}>
            {m.label}
          </div>
        ))}
      </div>
      {/* Scrolling rows */}
      <div data-scroll onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)} onMouseLeave={() => setHover(null)}
        style={{ position: "absolute", left: 0, right: 0, top: axisH, height: viewH, overflowY: "auto", overflowX: "hidden", overscrollBehavior: "contain" }}>
      <div style={{ position: "relative", height: innerH }}>
      {/* Grid and key-date lines */}
      <div style={{ position: "absolute", left: G_LABEL_W, top: 0, width: G_CHART_W, height: innerH }}>
        {weekends && <div style={weekends} />}
        {ticksFor(lo, hi).map((d) => <div key={d} style={{ position: "absolute", left: x(d), top: 0, bottom: 0, borderLeft: `1px solid ${C.grid}` }} />)}
        {shown.map((m, i) => (
          <div key={`${m.label}-${i}`} style={{ position: "absolute", left: x(m.day), top: 0, bottom: 0, borderLeft: `2px ${m.estimated ? "dashed" : "solid"} ${m.kind === "week0" ? C.accent : C.faint}` }} />
        ))}
      </div>
      {/* Rows */}
      {items.map((it, r) => {
        const top = r * rowH;
        const color = teamColor(it.subTeam);
        const x1 = x(it.start), x2 = x(it.due);
        const barW = Math.max(6, x2 - x1);
        const tag = it.isMilestone ? labels.date(it.due) : `${it.due - it.start}d · due ${labels.date(it.due)}`;
        const tagRight = x2 + 12 + 120 < G_CHART_W;
        // Clear of the diamond (or the bar end)
        const gap = it.isMilestone ? rowH * 0.4 + 8 : 12;
        return (
          <div key={it.key} onMouseEnter={() => setHover(r)}
            style={{ position: "absolute", left: 0, top, width: G_ROW_W, height: rowH, background: hover === r ? "rgba(29,58,138,.08)" : r % 2 ? "rgba(15,23,42,.025)" : "transparent" }}>
            <div style={{ position: "absolute", left: 0, width: G_LABEL_W - 16, top: 0, height: rowH, display: "flex", alignItems: "center", gap: 8, fontSize: font }}>
              <span style={{ width: 8, height: 8, borderRadius: 4, background: color, flex: "none" }} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: it.isMilestone ? 700 : 500 }}>
                {it.isMilestone ? "◆ " : ""}{it.name}{it.suffix ? <span style={{ color: C.muted }}> — {it.suffix}</span> : null}
              </span>
            </div>
            <div style={{ position: "absolute", left: G_LABEL_W, top: 0, width: G_CHART_W, height: rowH }}>
              {dayW >= 4 && <div style={dayTicks} />}
              <div style={weekTicks} />
              {it.isMilestone ? (
                <div style={{ position: "absolute", left: x2 - rowH * 0.25, top: rowH * 0.25, width: rowH * 0.5, height: rowH * 0.5, background: it.estimated ? "transparent" : C.milestone, border: `2px ${it.estimated ? "dashed" : "solid"} ${C.milestone}`, transform: "rotate(45deg)" }} />
              ) : (
                <div style={{
                  position: "absolute", left: x1, width: barW, top: rowH * 0.22, height: rowH * 0.56, borderRadius: rowH * 0.28,
                  background: it.estimated ? `repeating-linear-gradient(45deg, ${color}33 0 6px, ${color}66 6px 12px)` : color,
                  border: it.estimated ? `2px dashed ${color}` : "none",
                }} />
              )}
              <div style={{ position: "absolute", top: 0, height: rowH, display: "flex", alignItems: "center", fontSize: font - 2, color: C.muted, whiteSpace: "nowrap", ...(tagRight ? { left: x2 + gap } : { right: G_CHART_W - (it.isMilestone ? x2 : x1) + gap }) }}>{tag}</div>
            </div>
          </div>
        );
      })}
      </div>
      </div>
      {/* A soft fade says there's more below */}
      {scrolls && <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 36, background: "linear-gradient(rgba(255,255,255,0), #fff)", pointerEvents: "none" }} />}
      {hover != null && items[hover] && (
        <HoverCard item={items[hover]} labels={labels}
          rowTop={axisH + hover * rowH - scrollTop} rowH={rowH} height={height}
          left={Math.max(0, Math.min(G_ROW_W - 460, G_LABEL_W + x(items[hover].start) - 24))} />
      )}
    </div>
  );
}

/** Everything about one Gantt row — full name (even when the row cuts it off), dates, rule */
function HoverCard({ item: it, labels, rowTop, rowH, height, left }: {
  item: TimelineItem; labels: Labels; rowTop: number; rowH: number; height: number; left: number;
}) {
  // Below the row, or above it in the lower half so it stays on the slide
  const above = rowTop > height / 2;
  const line = (label: string, value: React.ReactNode) => (
    <div style={{ display: "flex", gap: 10 }}>
      <span style={{ color: "#94a3b8", width: 84, flex: "none" }}>{label}</span>
      <span>{value}</span>
    </div>
  );
  return (
    <div style={{
      position: "absolute", left, width: 460, zIndex: 5, pointerEvents: "none",
      ...(above ? { bottom: height - rowTop + 8 } : { top: rowTop + rowH + 8 }),
      background: "#0f172a", color: "#fff", borderRadius: 14, padding: "16px 20px",
      boxShadow: "0 12px 32px rgba(15,23,42,.35)", fontSize: 18, lineHeight: 1.45,
    }}>
      <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.25, marginBottom: 8 }}>
        {it.isMilestone ? "◆ " : ""}{it.name}{it.suffix ? <span style={{ color: "#cbd5e1", fontWeight: 500 }}> — {it.suffix}</span> : null}
      </div>
      {line("Sub-team", <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><span style={{ width: 12, height: 12, borderRadius: 6, background: teamColor(it.subTeam) }} />{teamLabel(it.subTeam)}</span>)}
      {it.isMilestone
        ? line("Due", labels.long(it.due))
        : <>
            {line("Starts", labels.long(it.start))}
            {line("Due", `${labels.long(it.due)} · ${it.due - it.start} day${it.due - it.start === 1 ? "" : "s"} of work`)}
          </>}
      {line("Rule", `due ${it.rule}`)}
      {it.hours != null && !it.isMilestone && line("Effort", `${it.hours} hour${it.hours === 1 ? "" : "s"} estimated`)}
      {it.designReview && line("Review", "Design review required")}
      {it.estimated && line("Note", "No matching event in the example season — date estimated")}
      {it.description && <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,.15)", color: "#e2e8f0" }}>{it.description}</div>}
    </div>
  );
}

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div style={{ flex: 1, background: C.band, border: `1px solid ${C.grid}`, borderRadius: 20, padding: "28px 32px" }}>
      <div style={{ fontSize: 64, fontWeight: 800, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 22, color: C.muted, marginTop: 10 }}>{label}</div>
    </div>
  );
}

// ── Slides ──────────────────────────────────────────────────────────────────

function buildSlides(name: string, description: string | null, teamNumber: number | null, tasks: TimelineTask[], tl: Timeline): React.ReactNode[] {
  const labels = makeLabels(tl.kickoff);
  const { items, markers } = tl;
  const anyEstimated = items.some((i) => i.estimated) || markers.some((m) => m.estimated);
  const seasonNote = tl.illustrative
    ? `For illustration: an example season with kickoff ${labels.long(0)}, Week 2 and Week 4 events, district playoffs in Week 6 and Worlds in April. Your real dates will differ.`
    : tl.seasonName
    ? `Dates shown for ${tl.seasonName}${anyEstimated ? " — dashed items aren't in the season yet, so their dates are estimates" : ""}.`
    : "No active season — dates are counted from kickoff and competitions are estimated.";
  const slides: React.ReactNode[] = [];

  // 1. Title
  const [lo, hi] = rangeOf(items, 0);
  const tasksOnly = tasks.filter((t) => !t.isMilestone);
  const hours = tasksOnly.reduce((s, t) => s + (t.estimatedHours ?? 0), 0);
  const teams = new Set(tasks.map((t) => t.subTeam).filter(Boolean));
  // The sub-teams in this template, in the usual order (plus "No sub-team" if any), for
  // the color key shown from the first slide on
  const keyTeams: (string | null)[] = [
    ...SUBTEAM_OPTIONS.map((o) => o.value).filter((v) => teams.has(v)),
    ...(tasks.some((t) => !t.subTeam) ? [null] : []),
  ];
  // Gantt slides carry two footer lines: the color key and the chart legend
  // Compact slide: 28px margins, ~43px title row, ~48px footer (team key + legend)
  const ganttH = H - 56 - 43 - 56;
  slides.push(
    <Slide key="title">
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 26, fontWeight: 600, color: C.accent, textTransform: "uppercase", letterSpacing: 1 }}>
          {teamNumber ? `Team ${teamNumber} · ` : ""}Season plan
        </div>
        <div style={{ fontSize: 88, fontWeight: 800, lineHeight: 1.05, marginTop: 12 }}>{name}</div>
        {description && <div style={{ fontSize: 30, color: C.muted, marginTop: 20, maxWidth: 1250 }}>{description}</div>}
        <div style={{ display: "flex", gap: 24, marginTop: 64 }}>
          <Stat value={tasksOnly.length} label="tasks" />
          <Stat value={tasks.length - tasksOnly.length} label="milestones" />
          <Stat value={items.length ? `${Math.max(1, Math.round((hi - lo) / 7))} wk` : "—"} label={items.length ? `${labels.date(lo)} → ${labels.date(hi)}` : "timeline"} />
          <Stat value={teams.size} label="sub-teams involved" />
          {hours > 0 && <Stat value={Math.round(hours)} label="estimated hours" />}
        </div>
        {keyTeams.length > 0 && (
          <div style={{ marginTop: 36, color: C.text }}>
            <TeamKey teams={keyTeams} size={22} />
          </div>
        )}
        <div style={{ fontSize: 20, color: C.muted, marginTop: 28 }}>{seasonNote}</div>
      </div>
    </Slide>,
  );

  if (items.length === 0) {
    slides.push(<Slide key="empty" title="This template is empty"><div style={{ fontSize: 30, color: C.muted }}>Add tasks and milestones to the template, then present it again.</div></Slide>);
    return slides;
  }

  // 2. Milestones first — the dates the plan works toward — top to bottom, with the key dates they fall around
  const ms = items.filter((i) => i.isMilestone);
  if (ms.length) {
    type Row = { kind: "milestone"; m: TimelineItem; gap: number | null } | { kind: "marker"; mk: TimelineMarker };
    const rows: Row[] = [];
    ms.forEach((m, i) => {
      const prev = ms[i - 1];
      for (const mk of markers) {
        if (mk.day <= m.due && (!prev || mk.day > prev.due)) rows.push({ kind: "marker", mk });
      }
      rows.push({ kind: "milestone", m, gap: prev ? m.due - prev.due : null });
    });
    // One slide; a long list scrolls (like the Gantt slides) instead of spilling over
    [rows].forEach((page, p, all) => {
      const listH = page.length * 78 + 24;
      slides.push(
        <Slide key={`ms-${p}`} kicker="Checkpoints" title={all.length > 1 ? `Milestones (${p + 1} of ${all.length})` : "Milestones"} footer="The dates the team is working toward.">
          <div data-scroll style={{ position: "absolute", inset: 0, overflowY: "auto", overflowX: "hidden", overscrollBehavior: "contain" }}>
          <div style={{ position: "relative", height: listH }}>
          <div style={{ position: "absolute", left: 284, top: 0, height: listH, borderLeft: `4px solid ${C.grid}` }} />
          {page.map((row, i) => {
            const top = i * 78;
            if (row.kind === "marker") {
              return (
                <div key={`mk-${i}`} style={{ position: "absolute", top, left: 0, right: 0, height: 78, display: "flex", alignItems: "center" }}>
                  <div style={{ width: 250, textAlign: "right", fontSize: 18, color: C.muted }}>{labels.long(row.mk.day)}</div>
                  <div style={{ width: 68, display: "flex", justifyContent: "center" }}>
                    <div style={{ width: 14, height: 14, borderRadius: 7, background: row.mk.kind === "week0" ? C.accent : C.faint }} />
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: row.mk.kind === "week0" ? C.accent : C.secondary, textTransform: "uppercase", letterSpacing: 0.5 }}>{row.mk.label}</div>
                </div>
              );
            }
            const { m, gap } = row;
            return (
              <div key={m.key} style={{ position: "absolute", top, left: 0, right: 0, height: 78, display: "flex", alignItems: "center" }}>
                <div style={{ width: 250, textAlign: "right", fontSize: 22, fontWeight: 600 }}>{labels.long(m.due)}</div>
                <div style={{ width: 68, display: "flex", justifyContent: "center" }}>
                  <div style={{ width: 26, height: 26, background: m.estimated ? "#fff" : C.milestone, border: `3px ${m.estimated ? "dashed" : "solid"} ${C.milestone}`, transform: "rotate(45deg)" }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div title={`${m.name}${m.suffix ? ` — ${m.suffix}` : ""}`} style={{ fontSize: 28, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {m.name}{m.suffix ? <span style={{ color: C.muted, fontWeight: 500 }}> — {m.suffix}</span> : null}
                  </div>
                  <div style={{ fontSize: 18, color: C.muted, marginTop: 2, display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 12, height: 12, borderRadius: 6, background: teamColor(m.subTeam), flex: "none" }} />
                    <span>{teamLabel(m.subTeam)} · due {m.rule}{m.estimated ? " · estimated date" : ""}</span>
                  </div>
                </div>
                {gap != null && <div style={{ width: 190, textAlign: "right", fontSize: 18, color: gap >= 14 ? C.warn : C.muted }}>{gap === 0 ? "same day" : `+${gap} day${gap === 1 ? "" : "s"}`}</div>}
              </div>
            );
          })}
          </div>
          </div>
          {listH > 560 && <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 36, background: "linear-gradient(rgba(255,255,255,0), #fff)", pointerEvents: "none" }} />}
        </Slide>,
      );
    });
  }

  // 3. The whole timeline (split if it's long)
  const overview = [items];
  const range = rangeOf(items);
  overview.forEach((page, i) => {
    slides.push(
      <Slide compact key={`overview-${i}`} kicker="The whole plan" title={overview.length > 1 ? `Timeline (${i + 1} of ${overview.length})` : "Timeline"}
        footer={<div style={{ display: "flex", flexDirection: "column", gap: 4 }}><TeamKey teams={keyTeams} size={13} /><Legend estimated={anyEstimated} /></div>}>
        <Gantt items={page} range={range} markers={markers} labels={labels} height={ganttH} />
      </Slide>,
    );
  });

  // 4. Each phase, zoomed in
  for (const phase of PHASES) {
    const phaseItems = items.filter((i) => phase.anchors.includes(i.anchor));
    if (!phaseItems.length) continue;
    const pr = rangeOf(phaseItems);
    [phaseItems].forEach((page, p, all) => {
      slides.push(
        <Slide compact key={`${phase.key}-${p}`} kicker={phase.subtitle} title={all.length > 1 ? `${phase.title} (${p + 1} of ${all.length})` : phase.title}
          footer={<div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <TeamKey teams={keyTeams.filter((t) => page.some((i) => i.subTeam === t))} size={13} />
            <span>{page.filter((i) => !i.isMilestone).length} tasks · {page.filter((i) => i.isMilestone).length} milestones — each row shows its length and due date</span>
          </div>}>
          <Gantt items={page} range={pr} markers={markers} labels={labels} height={ganttH} />
        </Slide>,
      );
    });
  }

  // 5. Who's busy when, and weeks with nothing due
  const lanes = [...new Set(items.map((i) => i.subTeam))].sort((a, b) => teamLabel(a).localeCompare(teamLabel(b)));
  {
    const [wlo, whi] = range;
    const x = (d: number) => ((d - wlo) / (whi - wlo)) * CHART_W;
    const laneH = Math.min(54, Math.floor(420 / Math.max(1, lanes.length)));
    const firstWeek = Math.floor(wlo / 7);
    const weeks = Array.from({ length: Math.ceil(whi / 7) - firstWeek }, (_, i) => firstWeek + i);
    const dueIn = weeks.map((w) => items.filter((i) => Math.floor(i.due / 7) === w).length);
    const maxDue = Math.max(1, ...dueIn);
    slides.push(
      <Slide key="load" kicker="Workload" title="Who's busy when" footer="Darker lanes mean more going on at once. Amber weeks have nothing due — a gap, or a well-earned break?">
        <div style={{ position: "relative", height: lanes.length * laneH + 10 }}>
          {lanes.map((lane, r) => {
            const laneItems = items.filter((i) => i.subTeam === lane);
            return (
              <div key={lane ?? "none"} style={{ position: "absolute", left: 0, top: r * laneH, width: W - PAD * 2, height: laneH, borderBottom: `1px solid ${C.grid}` }}>
                <div style={{ position: "absolute", left: 0, width: LABEL_W - 16, height: laneH, display: "flex", alignItems: "center", gap: 10, fontSize: 20 }}>
                  <span style={{ width: 14, height: 14, borderRadius: 7, background: teamColor(lane) }} />
                  <span style={{ fontWeight: 600 }}>{teamLabel(lane)}</span>
                  <span style={{ color: C.muted, fontSize: 16 }}>{laneItems.length}</span>
                </div>
                <div style={{ position: "absolute", left: LABEL_W, width: CHART_W, top: 0, height: laneH }}>
                  {laneItems.map((it) => it.isMilestone ? (
                    <div key={it.key} style={{ position: "absolute", left: x(it.due) - 7, top: laneH / 2 - 7, width: 14, height: 14, background: C.milestone, transform: "rotate(45deg)" }} />
                  ) : (
                    <div key={it.key} style={{ position: "absolute", left: x(it.start), width: Math.max(4, x(it.due) - x(it.start)), top: laneH * 0.2, height: laneH * 0.6, borderRadius: 6, background: teamColor(lane), opacity: 0.3 }} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 200 }}>
          <div style={{ position: "absolute", left: 0, width: LABEL_W - 16, bottom: 40, fontSize: 20, fontWeight: 600 }}>
            Due each week
          </div>
          <div style={{ position: "absolute", left: LABEL_W, width: CHART_W, top: 0, bottom: 40, display: "flex", alignItems: "flex-end", gap: 4 }}>
            {weeks.map((w, i) => (
              <div key={w} title={`${dueIn[i]} due`} style={{ flex: 1, height: dueIn[i] ? `${(dueIn[i] / maxDue) * 100}%` : 10, background: dueIn[i] ? C.secondary : C.warn, opacity: dueIn[i] ? 0.85 : 0.6, borderRadius: 4 }} />
            ))}
          </div>
          <div style={{ position: "absolute", left: LABEL_W, width: CHART_W, bottom: 8, height: 26 }}>
            {ticksFor(wlo, whi).map((d) => <div key={d} style={{ position: "absolute", left: x(d), transform: "translateX(-50%)", fontSize: 15, color: C.muted, whiteSpace: "nowrap" }}>{labels.tick(d)}</div>)}
          </div>
        </div>
      </Slide>,
    );
  }

  // 6. What might be missing
  const checks = templateChecks(tasks, tl, SUBTEAM_OPTIONS, labels.date);
  slides.push(
    <Slide key="checks" kicker="Before we start" title="What might be missing?" footer={`${checks.filter((c) => c.ok).length} of ${checks.length} look good`}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "22px 48px" }}>
        {checks.map((c, i) => (
          <div key={i} style={{ display: "flex", gap: 18, alignItems: "flex-start" }}>
            <div style={{ flex: "none", width: 44, height: 44, borderRadius: 22, background: c.ok ? "#dcfce7" : "#fef3c7", color: c.ok ? C.ok : C.warn, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, fontWeight: 800 }}>
              {c.ok ? "✓" : "!"}
            </div>
            <div>
              <div style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.25 }}>{c.title}</div>
              {c.detail && <div style={{ fontSize: 19, color: C.muted, marginTop: 4, lineHeight: 1.35 }}>{c.detail}</div>}
            </div>
          </div>
        ))}
      </div>
    </Slide>,
  );

  // 7. End
  slides.push(
    <Slide key="end">
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", textAlign: "center" }}>
        <div style={{ fontSize: 76, fontWeight: 800 }}>Questions?</div>
        <div style={{ fontSize: 28, color: C.muted, marginTop: 20 }}>{name} · {tasksOnly.length} tasks · {tasks.length - tasksOnly.length} milestones</div>
      </div>
    </Slide>,
  );
  return slides;
}

// ── The presenter ───────────────────────────────────────────────────────────

export function TemplatePresentation({ templateId, name, description, teamNumber, tasks, season }: {
  templateId: string; name: string; description: string | null; teamNumber: number | null;
  tasks: TimelineTask[]; season: TimelineSeason | null;
}) {
  const slides = useMemo(() => buildSlides(name, description, teamNumber, tasks, buildTimeline(tasks, season)), [name, description, teamNumber, tasks, season]);
  const [index, setIndex] = useState(0);
  const [scale, setScale] = useState(0);
  const [chrome, setChrome] = useState(true);
  const rootRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const exitHref = `/tasks/templates/${templateId}`;
  const router = useRouter();

  const go = useCallback((delta: number) => setIndex((i) => Math.min(slides.length - 1, Math.max(0, i + delta))), [slides.length]);

  const toggleFullscreen = useCallback(() => {
    const el = rootRef.current as (HTMLDivElement & { webkitRequestFullscreen?: () => void }) | null;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else if (el?.requestFullscreen) el.requestFullscreen().catch(() => {});
    else el?.webkitRequestFullscreen?.();
  }, []);

  // Fit the 16:9 canvas to the screen
  useEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / W, window.innerHeight / H));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  // No page scrolling underneath while presenting
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Keyboard: arrows / space / page keys like a slide deck; F for full screen; Esc to leave
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const list = document.querySelector<HTMLElement>("[data-scroll]");
      if ((e.key === "ArrowDown" || e.key === "ArrowUp") && list && list.scrollHeight > list.clientHeight + 1) {
        e.preventDefault();
        list.scrollBy({ top: e.key === "ArrowDown" ? 160 : -160, behavior: "smooth" });
        return;
      }
      if (["ArrowRight", "ArrowDown", "PageDown", " ", "Enter"].includes(e.key)) { e.preventDefault(); go(1); }
      else if (["ArrowLeft", "ArrowUp", "PageUp", "Backspace"].includes(e.key)) { e.preventDefault(); go(-1); }
      else if (e.key === "Home") setIndex(0);
      else if (e.key === "End") setIndex(slides.length - 1);
      else if (e.key === "f" || e.key === "F") toggleFullscreen();
      else if (e.key === "Escape" && !document.fullscreenElement) router.push(exitHref);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, slides.length, toggleFullscreen, exitHref, router]);

  // Controls fade out when the mouse rests
  const wake = useCallback(() => {
    setChrome(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setChrome(false), 2500);
  }, []);
  useEffect(() => {
    hideTimer.current = setTimeout(() => setChrome(false), 2500);
    return () => clearTimeout(hideTimer.current);
  }, []);

  const btn: React.CSSProperties = { width: 44, height: 44, borderRadius: 22, border: "none", background: "rgba(255,255,255,.12)", color: "#fff", fontSize: 22, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" };

  return (
    <div
      ref={rootRef}
      onMouseMove={wake}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("[data-controls]")) return;
        const list = (e.target as HTMLElement).closest<HTMLElement>("[data-scroll]");
        if (list && list.scrollHeight > list.clientHeight + 1) return; go(e.clientX < window.innerWidth * 0.3 ? -1 : 1); }}
      onTouchStart={(e) => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; wake(); }}
      onTouchEnd={(e) => {
        const start = touch.current; touch.current = null;
        if (!start) return;
        const dx = e.changedTouches[0].clientX - start.x;
        const dy = e.changedTouches[0].clientY - start.y;
        // Sideways swipes change slides; up/down swipes scroll a long list
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
      }}
      style={{ position: "fixed", inset: 0, zIndex: 100, background: "#000", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", cursor: chrome ? "default" : "none", userSelect: "none" }}
    >
      {scale > 0 && (
        <div style={{ width: W * scale, height: H * scale, position: "relative", boxShadow: "0 0 60px rgba(0,0,0,.5)" }}>
          <div style={{ width: W, height: H, transform: `scale(${scale})`, transformOrigin: "top left" }}>
            {slides[index]}
          </div>
        </div>
      )}

      <div data-controls style={{ position: "fixed", left: "50%", bottom: 18, transform: "translateX(-50%)", display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 30, background: "rgba(15,23,42,.85)", color: "#fff", opacity: chrome ? 1 : 0, transition: "opacity .3s", pointerEvents: chrome ? "auto" : "none" }}>
        <button type="button" style={btn} onClick={() => go(-1)} aria-label="Previous slide" disabled={index === 0}>‹</button>
        <span style={{ minWidth: 70, textAlign: "center", fontSize: 15, fontVariantNumeric: "tabular-nums" }}>{index + 1} / {slides.length}</span>
        <button type="button" style={btn} onClick={() => go(1)} aria-label="Next slide" disabled={index === slides.length - 1}>›</button>
        <button type="button" style={{ ...btn, fontSize: 18 }} onClick={toggleFullscreen} aria-label="Full screen" title="Full screen (F)">⛶</button>
        <Link href={exitHref} style={{ ...btn, fontSize: 18, textDecoration: "none" }} aria-label="Exit presentation" title="Exit (Esc)">✕</Link>
      </div>
    </div>
  );
}
