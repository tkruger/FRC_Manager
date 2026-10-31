"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SUBTEAM_COLORS, SUBTEAM_OPTIONS } from "@/lib/schedule-helpers";

// The task board for a TV. A fixed 1920×1080 canvas scaled to the screen, cycling between the
// board and the 11-day timeline (more pages when there's more than fits). New data every
// minute; the screen is kept awake where the browser allows it.

const W = 1920;
const H = 1080;
const PAD = 40;
const REFRESH_MS = 60_000;
const SLIDE_MS = 20_000;

export interface PresenterTask {
  id: string;
  name: string;
  subTeam: string | null;
  status: string;
  priority: string;
  milestone: boolean;
  /** Calendar days, YYYY-MM-DD */
  start: string | null;
  due: string | null;
  /** The day it was completed */
  done: string | null;
  people: string[];
}
export interface PresenterEvent { name: string; start: string; end: string }

const C = {
  bg: "#0b1020", panel: "#121a30", line: "#1f2a44", text: "#f1f5f9", muted: "#94a3b8", faint: "#64748b",
  today: "#f59e0b", danger: "#f87171", done: "#34d399",
};

const TEAM_LABEL: Record<string, string> = Object.fromEntries(SUBTEAM_OPTIONS.map((o) => [o.value, o.label]));
const teamColor = (t: string | null) => (t && SUBTEAM_COLORS[t]) || "#64748b";
/** Sticky-note paper in the sub-team's color (dark text stays readable) */
const paper = (t: string | null) => (t && SUBTEAM_COLORS[t] ? `color-mix(in srgb, ${SUBTEAM_COLORS[t]} 38%, #fff)` : "#FFE97A");

const dayNum = (key: string) => Date.parse(`${key}T00:00:00Z`) / 86_400_000;
const fmtDay = (key: string, o: Intl.DateTimeFormatOptions) => new Date(`${key}T12:00:00Z`).toLocaleDateString("en-US", { ...o, timeZone: "UTC" });

/** "Due today", "Due Thu", "Due Nov 12", "3 days overdue" */
function dueText(t: PresenterTask, today: string): { text: string; late: boolean } | null {
  if (!t.due || t.status === "COMPLETE") return null;
  const d = dayNum(t.due) - dayNum(today);
  if (d < 0) return { text: `${-d} day${d === -1 ? "" : "s"} overdue`, late: true };
  if (d === 0) return { text: "Due today", late: false };
  if (d === 1) return { text: "Due tomorrow", late: false };
  if (d < 7) return { text: `Due ${fmtDay(t.due, { weekday: "long" })}`, late: false };
  return { text: `Due ${fmtDay(t.due, { month: "short", day: "numeric" })}`, late: false };
}

// ── The board ───────────────────────────────────────────────────────────────

const COLUMNS = [
  { id: "NOT_STARTED", label: "To do",       accent: "#94a3b8" },
  { id: "IN_PROGRESS", label: "In progress", accent: "#60a5fa" },
  { id: "BLOCKED",     label: "Blocked",     accent: "#f87171" },
  { id: "IN_REVIEW",   label: "In review",   accent: "#fbbf24" },
  { id: "COMPLETE",    label: "Done this week", accent: "#34d399" },
];
const CARD_H = 104;
const CARD_GAP = 12;

/** What belongs on the board: open work that's due, started or happening in the next 11 days; and the last week's finished tasks */
function boardTasks(tasks: PresenterTask[], today: string, last: string) {
  const weekAgo = new Date(Date.parse(`${today}T00:00:00Z`) - 6 * 86_400_000).toISOString().slice(0, 10);
  return tasks.filter((t) => {
    if (t.status === "COMPLETE") return !!t.done && t.done >= weekAgo;
    if (t.status !== "NOT_STARTED") return true;
    return (!!t.start && t.start <= last) || (!!t.due && t.due <= last);
  });
}

function sortForBoard(a: PresenterTask, b: PresenterTask) {
  if (a.status === "COMPLETE") return (b.done ?? "").localeCompare(a.done ?? "");
  return (a.due ?? "9999").localeCompare(b.due ?? "9999") || a.name.localeCompare(b.name);
}

function Board({ tasks, today, last }: { tasks: PresenterTask[]; today: string; last: string }) {
  const shown = boardTasks(tasks, today, last);
  const fit = Math.floor((H - 190 - PAD) / (CARD_H + CARD_GAP));
  const colW = (W - PAD * 2 - 4 * 20) / 5;
  return (
    <div style={{ display: "flex", gap: 20, height: "100%" }}>
      {COLUMNS.map((col) => {
        const list = shown.filter((t) => t.status === col.id).sort(sortForBoard);
        const more = list.length - fit;
        const visible = more > 0 ? list.slice(0, fit - 1) : list;
        return (
          <div key={col.id} style={{ width: colW, display: "flex", flexDirection: "column", background: C.panel, borderRadius: 16, padding: 14, minHeight: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "2px 4px 12px" }}>
              <span style={{ width: 14, height: 14, borderRadius: 7, background: col.accent }} />
              <span style={{ fontSize: 24, fontWeight: 700 }}>{col.label}</span>
              <span style={{ marginLeft: "auto", fontSize: 24, color: C.muted, fontWeight: 600 }}>{list.length}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: CARD_GAP }}>
              {visible.map((t) => <Card key={t.id} t={t} today={today} />)}
              {more > 0 && (
                <div style={{ height: CARD_H, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, color: C.muted, border: `2px dashed ${C.line}`, borderRadius: 10 }}>
                  +{more + 1} more
                </div>
              )}
              {list.length === 0 && <div style={{ fontSize: 20, color: C.faint, padding: "8px 4px" }}>Nothing here</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Card({ t, today }: { t: PresenterTask; today: string }) {
  const due = dueText(t, today);
  const done = t.status === "COMPLETE";
  return (
    <div style={{
      height: CARD_H, background: paper(t.subTeam), color: "#1f2430", borderRadius: 6, padding: "10px 14px",
      display: "flex", flexDirection: "column", justifyContent: "space-between", boxShadow: "0 4px 10px rgb(0 0 0 / .35)",
      borderTop: `6px solid ${teamColor(t.subTeam)}`, opacity: done ? 0.75 : 1,
    }}>
      <div style={{ fontSize: 21, fontWeight: 700, lineHeight: 1.2, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
        {t.milestone && "◆ "}{done && "✓ "}{t.name}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 16, fontWeight: 600, whiteSpace: "nowrap" }}>
        <span style={{ color: due?.late ? "#b91c1c" : "#3f4655" }}>{due?.text ?? (t.subTeam ? TEAM_LABEL[t.subTeam] : "")}</span>
        <span style={{ color: "#3f4655", overflow: "hidden", textOverflow: "ellipsis" }}>{t.people.slice(0, 3).join(", ")}{t.people.length > 3 ? ` +${t.people.length - 3}` : ""}</span>
      </div>
    </div>
  );
}

// ── The timeline ────────────────────────────────────────────────────────────

const LABEL_W = 430;
const ROW_H = 44;
const HEAD_H = 70;
const EVENT_H = 34;
export const TIMELINE_ROWS = Math.floor((H - 190 - PAD - HEAD_H - EVENT_H) / ROW_H);

/** On the timeline: anything with dates in the 11 days, plus open work that's overdue */
export function timelineTasks(tasks: PresenterTask[], today: string, last: string) {
  return tasks
    .filter((t) => t.start || t.due)
    .map((t) => ({ ...t, from: t.start ?? t.due!, to: t.due ?? t.start! }))
    .filter((t) => (t.from <= last && t.to >= today) || (t.status !== "COMPLETE" && t.to < today))
    .sort((a, b) => {
      const lateA = a.status !== "COMPLETE" && a.to < today, lateB = b.status !== "COMPLETE" && b.to < today;
      return Number(lateB) - Number(lateA) || a.from.localeCompare(b.from) || (a.subTeam ?? "").localeCompare(b.subTeam ?? "") || a.name.localeCompare(b.name);
    });
}

function Timeline({ rows, days, today, events, page, pages }: {
  rows: ReturnType<typeof timelineTasks>; days: string[]; today: string; events: PresenterEvent[]; page: number; pages: number;
}) {
  const chartW = W - PAD * 2 - LABEL_W;
  const dayW = chartW / days.length;
  const first = days[0], last = days[days.length - 1];
  const col = (key: string) => Math.max(0, Math.min(days.length, dayNum(key) - dayNum(first)));
  return (
    <div style={{ position: "relative", height: "100%" }}>
      {/* Day headers */}
      <div style={{ display: "flex", marginLeft: LABEL_W, height: HEAD_H }}>
        {days.map((d) => {
          const isToday = d === today;
          const weekend = [0, 6].includes(new Date(`${d}T12:00:00Z`).getUTCDay());
          return (
            <div key={d} style={{ width: dayW, textAlign: "center", borderRadius: "10px 10px 0 0", paddingTop: 6,
              background: isToday ? C.today : weekend ? "rgba(255,255,255,.04)" : "transparent", color: isToday ? "#111" : C.text }}>
              <div style={{ fontSize: 18, fontWeight: 600, color: isToday ? "#111" : C.muted }}>{isToday ? "Today" : fmtDay(d, { weekday: "short" })}</div>
              <div style={{ fontSize: 26, fontWeight: 800 }}>{fmtDay(d, { month: "short", day: "numeric" })}</div>
            </div>
          );
        })}
      </div>
      {/* Competitions in the window */}
      <div style={{ position: "relative", marginLeft: LABEL_W, height: EVENT_H }}>
        {events.map((e) => (
          <div key={e.name + e.start} style={{ position: "absolute", top: 4, height: EVENT_H - 8, left: col(e.start) * dayW + 2, width: Math.max(dayW - 4, (col(addDay(e.end)) - col(e.start)) * dayW - 4),
            background: "rgba(245,158,11,.18)", border: `1px solid ${C.today}`, borderRadius: 8, fontSize: 17, fontWeight: 700, color: C.today,
            display: "flex", alignItems: "center", padding: "0 10px", whiteSpace: "nowrap", overflow: "hidden" }}>
            🏆 {e.name}
          </div>
        ))}
      </div>
      {/* Columns behind the rows */}
      <div style={{ position: "absolute", top: HEAD_H, bottom: 0, left: LABEL_W, right: 0, display: "flex", pointerEvents: "none" }}>
        {days.map((d) => (
          <div key={d} style={{ width: dayW, borderLeft: `1px solid ${C.line}`, background: d === today ? "rgba(245,158,11,.08)" : "transparent" }} />
        ))}
      </div>
      {/* Rows */}
      <div style={{ position: "relative" }}>
        {rows.length === 0 && <div style={{ fontSize: 26, color: C.muted, padding: 24 }}>Nothing scheduled in the next {days.length} days.</div>}
        {rows.map((t, i) => {
          const late = t.status !== "COMPLETE" && t.to < today;
          const done = t.status === "COMPLETE";
          const a = late ? 0 : col(t.from), b = late ? 1 : col(addDay(t.to));
          const left = a * dayW + 4, width = Math.max(dayW * 0.35, (b - a) * dayW - 8);
          const runsOn = !late && t.to > last;
          return (
            <div key={t.id} style={{ display: "flex", alignItems: "center", height: ROW_H, background: i % 2 ? "rgba(255,255,255,.025)" : "transparent" }}>
              <div style={{ width: LABEL_W, paddingRight: 16, display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                <span style={{ width: 12, height: 12, borderRadius: 6, background: teamColor(t.subTeam), flexShrink: 0 }} />
                <span style={{ fontSize: 21, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: done ? C.muted : C.text, textDecoration: done ? "line-through" : "none" }}>
                  {t.name}
                </span>
              </div>
              <div style={{ position: "relative", flex: 1, height: "100%" }}>
                {t.milestone ? (
                  <span style={{ position: "absolute", top: ROW_H / 2 - 11, left: (late ? 0.5 : col(t.to) + 0.5) * dayW - 11, width: 22, height: 22,
                    background: late ? C.danger : teamColor(t.subTeam), transform: "rotate(45deg)", borderRadius: 3, boxShadow: "0 0 0 2px #0b1020" }} />
                ) : (
                  <div style={{ position: "absolute", top: 8, height: ROW_H - 16, left, width, borderRadius: 8,
                    background: late ? C.danger : teamColor(t.subTeam), opacity: done ? 0.45 : 1,
                    display: "flex", alignItems: "center", padding: "0 10px", fontSize: 15, fontWeight: 700, color: "#fff", whiteSpace: "nowrap", overflow: "hidden" }}>
                    {late ? `${dayNum(today) - dayNum(t.to)}d late` : done ? "✓ Done" : t.people.slice(0, 2).join(", ")}
                    {runsOn && <span style={{ marginLeft: "auto", paddingLeft: 6 }}>→ {fmtDay(t.to, { month: "short", day: "numeric" })}</span>}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {pages > 1 && <div style={{ position: "absolute", right: 0, bottom: -4, fontSize: 18, color: C.muted }}>Page {page + 1} of {pages}</div>}
    </div>
  );
}

function addDay(key: string) {
  return new Date(Date.parse(`${key}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
}

// ── The presenter ───────────────────────────────────────────────────────────

type SlideId = { kind: "board" } | { kind: "timeline"; page: number };

export function TaskBoardPresenter({ teamNumber, seasonName, today, days, tasks, events, show, timeZone }: {
  teamNumber: number | null; seasonName: string; today: string; days: string[];
  tasks: PresenterTask[]; events: PresenterEvent[]; show: "board" | "timeline" | "both"; timeZone: string;
}) {
  const router = useRouter();
  const last = days[days.length - 1];
  const rows = useMemo(() => timelineTasks(tasks, today, last), [tasks, today, last]);
  const pages = Math.max(1, Math.ceil(rows.length / TIMELINE_ROWS));
  const slides: SlideId[] = useMemo(() => [
    ...(show !== "timeline" ? [{ kind: "board" as const }] : []),
    ...(show !== "board" ? Array.from({ length: pages }, (_, page) => ({ kind: "timeline" as const, page })) : []),
  ], [show, pages]);

  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [scale, setScale] = useState(0);
  const [chrome, setChrome] = useState(true);
  const [now, setNow] = useState(() => new Date());
  const [updated, setUpdated] = useState(() => new Date());
  const rootRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const slide = slides[Math.min(index, slides.length - 1)];

  const go = useCallback((delta: number) => setIndex((i) => (i + delta + slides.length) % slides.length), [slides.length]);

  // Fit the canvas to the screen
  useEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / W, window.innerHeight / H));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  // New data every minute (and when the screen comes back); the clock ticks
  useEffect(() => {
    const refresh = () => { router.refresh(); setUpdated(new Date()); };
    const timer = setInterval(refresh, REFRESH_MS);
    const clock = setInterval(() => setNow(new Date()), 15_000);
    const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(timer); clearInterval(clock); document.removeEventListener("visibilitychange", onVisible); };
  }, [router]);

  // Next slide every 20 seconds unless paused
  useEffect(() => {
    if (paused || slides.length < 2) return;
    const t = setInterval(() => go(1), SLIDE_MS);
    return () => clearInterval(t);
  }, [paused, slides.length, go]);

  // Keep the TV from going to sleep (where the browser supports it)
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (type: "screen") => Promise<{ release: () => Promise<void> }> } };
    const take = () => { nav.wakeLock?.request("screen").then((l) => { lock = l; }).catch(() => {}); };
    take();
    const onVisible = () => { if (document.visibilityState === "visible") take(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { document.removeEventListener("visibilitychange", onVisible); lock?.release().catch(() => {}); };
  }, []);

  // No page scrolling underneath
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const toggleFullscreen = useCallback(() => {
    const el = rootRef.current as (HTMLDivElement & { webkitRequestFullscreen?: () => void }) | null;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else if (el?.requestFullscreen) el.requestFullscreen().catch(() => {});
    else el?.webkitRequestFullscreen?.();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (["ArrowRight", "PageDown", " "].includes(e.key)) { e.preventDefault(); go(1); }
      else if (["ArrowLeft", "PageUp"].includes(e.key)) { e.preventDefault(); go(-1); }
      else if (e.key === "p" || e.key === "P") setPaused((p) => !p);
      else if (e.key === "f" || e.key === "F") toggleFullscreen();
      else if (e.key === "Escape" && !document.fullscreenElement) router.push("/tasks");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, toggleFullscreen, router]);

  const wake = useCallback(() => {
    setChrome(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setChrome(false), 3000);
  }, []);
  useEffect(() => {
    hideTimer.current = setTimeout(() => setChrome(false), 3000);
    return () => clearTimeout(hideTimer.current);
  }, []);

  const time = (d: Date) => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone });
  const btn: React.CSSProperties = { height: 44, minWidth: 44, padding: "0 14px", borderRadius: 22, border: "none", background: "rgba(255,255,255,.12)", color: "#fff", fontSize: 16, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", textDecoration: "none" };
  const usedTeams = [...new Set(tasks.filter((t) => t.status !== "COMPLETE").map((t) => t.subTeam).filter(Boolean))] as string[];

  return (
    <div ref={rootRef} onMouseMove={wake} onTouchStart={wake}
      style={{ position: "fixed", inset: 0, zIndex: 100, background: "#000", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", cursor: chrome ? "default" : "none" }}>
      {scale > 0 && (
        <div style={{ width: W * scale, height: H * scale, position: "relative" }}>
          <div style={{ width: W, height: H, transform: `scale(${scale})`, transformOrigin: "top left", background: C.bg, color: C.text, padding: PAD, display: "flex", flexDirection: "column", fontFamily: "var(--font-inter), system-ui, sans-serif" }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "flex-end", gap: 24, marginBottom: 24, height: 86 }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 700, color: C.today, letterSpacing: 1, textTransform: "uppercase" }}>
                  {teamNumber ? `Team ${teamNumber} · ` : ""}{seasonName}
                </div>
                <div style={{ fontSize: 48, fontWeight: 800, lineHeight: 1.1 }}>
                  {slide.kind === "board" ? "Task board" : "Next 11 days"}
                </div>
              </div>
              <div style={{ display: "flex", gap: 18, flexWrap: "wrap", maxWidth: 820, fontSize: 18, color: C.muted, paddingBottom: 8 }}>
                {usedTeams.map((t) => (
                  <span key={t} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 14, height: 14, borderRadius: 7, background: teamColor(t) }} />{TEAM_LABEL[t] ?? t}
                  </span>
                ))}
              </div>
              <div style={{ marginLeft: "auto", textAlign: "right" }}>
                <div style={{ fontSize: 44, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{time(now)}</div>
                <div style={{ fontSize: 18, color: C.muted }}>
                  {fmtDay(today, { weekday: "long", month: "long", day: "numeric" })} · updated {time(updated)}
                </div>
              </div>
            </div>
            {/* Slide */}
            <div style={{ flex: 1, minHeight: 0 }}>
              {slide.kind === "board"
                ? <Board tasks={tasks} today={today} last={last} />
                : <Timeline rows={rows.slice(slide.page * TIMELINE_ROWS, (slide.page + 1) * TIMELINE_ROWS)} days={days} today={today} events={events} page={slide.page} pages={pages} />}
            </div>
            {/* Which slide */}
            {slides.length > 1 && (
              <div style={{ display: "flex", justifyContent: "center", gap: 10, paddingTop: 14 }}>
                {slides.map((_, i) => (
                  <span key={i} style={{ width: i === index ? 28 : 10, height: 10, borderRadius: 5, background: i === index ? C.today : C.line, transition: "width .3s" }} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div style={{ position: "fixed", left: "50%", bottom: 18, transform: "translateX(-50%)", display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 30, background: "rgba(15,23,42,.9)", color: "#fff", opacity: chrome ? 1 : 0, transition: "opacity .3s", pointerEvents: chrome ? "auto" : "none" }}>
        <button type="button" style={btn} onClick={() => go(-1)} aria-label="Previous">‹</button>
        <button type="button" style={btn} onClick={() => setPaused((p) => !p)}>{paused ? "▶ Play" : "❚❚ Pause"}</button>
        <button type="button" style={btn} onClick={() => go(1)} aria-label="Next">›</button>
        <Link href="/tasks/present?show=board" style={btn}>Board only</Link>
        <Link href="/tasks/present?show=timeline" style={btn}>Timeline only</Link>
        <Link href="/tasks/present" style={btn}>Both</Link>
        <button type="button" style={btn} onClick={toggleFullscreen} title="Full screen (F)">⛶</button>
        <Link href="/tasks" style={btn} aria-label="Exit" title="Exit (Esc)">✕</Link>
      </div>
    </div>
  );
}
