"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { SUBTEAM_COLORS, SUBTEAM_OPTIONS, STATUS_CONFIG, PRIORITY_CONFIG } from "@/lib/schedule-helpers";
import { formatDate } from "@/lib/utils";
import { Markdown } from "@/components/markdown/Markdown";

// The season's tasks on a timeline. Looks like the template presentation's Gantt: rows in
// the order things happen with sub-team color dots, shaded weekends, day ticks (taller at
// each week from kickoff), key-date lines, "5d · due Jan 12" beside each bar and a hover
// card with everything about the row. Adds what only the real season has: zoom, Today,
// status colors and click-for-details.

// ─── Types ────────────────────────────────────────────────────────────────────
export interface GanttTask {
  id: string;
  name: string;
  status: string;
  priority: string;
  subTeam: string | null;
  startDate: string;
  dueDate: string;
  isMilestone: boolean;
  details: string | null;
  blockersNotes: string | null;
  estimatedHours: number | null;
  actualHours: number | null;
  assignees: { name: string }[];
}

export interface GanttMarker {
  /** Days from kickoff */
  day: number;
  label: string;
  kind: "kickoff" | "week0" | "competition" | "end";
}

export interface GanttProps {
  tasks: GanttTask[];
  kickoffDate: string;
  endDate: string;
  seasonName: string;
  markers: GanttMarker[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const DAY = 86_400_000;
const LABEL_W = 240;
const ROW_H = 40;
const MILESTONE = "var(--color-text-primary)";

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}
const teamColor = (t: string | null) => (t ? SUBTEAM_COLORS[t] ?? "#64748B" : "#94A3B8");
const teamLabel = (t: string | null) => SUBTEAM_OPTIONS.find((o) => o.value === t)?.label ?? "No sub-team";

const ZOOM_LEVELS = [
  { label: "Season",  colW: 12, days: 0 },
  { label: "2 weeks", colW: 28, days: 14 },
  { label: "1 week",  colW: 56, days: 7 },
];

// ─── Component ────────────────────────────────────────────────────────────────
export function GanttClient({ tasks, kickoffDate, endDate, seasonName, markers }: GanttProps) {
  // Calendar dates are stored at UTC midnight: count whole days and show them in UTC
  const k = new Date(kickoffDate).getTime();
  const dayOf = (iso: string) => Math.round((new Date(iso).getTime() - k) / DAY);
  const fmt = (day: number, opts: Intl.DateTimeFormatOptions) => new Date(k + day * DAY).toLocaleDateString("en-US", { ...opts, timeZone: "UTC" });
  const short = (day: number) => fmt(day, { month: "short", day: "numeric" });
  const long = (day: number) => fmt(day, { weekday: "short", month: "short", day: "numeric" });
  const weekday = (day: number) => new Date(k + day * DAY).getUTCDay();

  const totalDays = dayOf(endDate) + 1;
  const now = new Date();
  const todayOff = Math.round((Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - k) / DAY);

  // ── State ──────────────────────────────────────────────────────────────────
  const [zoomIdx, setZoomIdx]     = useState(1);
  const [viewStart, setViewStart] = useState(0);
  const [modalTask, setModalTask] = useState<GanttTask | null>(null);
  const [hover, setHover]         = useState<{ task: GanttTask; x: number; y: number } | null>(null);
  const [effectiveColW, setEffectiveColW] = useState(ZOOM_LEVELS[1].colW);
  const containerRef = useRef<HTMLDivElement>(null);

  const zoom     = ZOOM_LEVELS[zoomIdx];
  const viewDays = zoom.days || totalDays;
  const viewEnd  = Math.min(viewStart + viewDays - 1, totalDays - 1);
  const shownDays = viewEnd - viewStart + 1;
  const colW     = effectiveColW;
  const chartW   = shownDays * colW;
  const x = (day: number) => (day - viewStart) * colW;

  // Stretch days to fill the width when the natural size is smaller
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    function recalc() {
      if (!el) return;
      const available = el.clientWidth - LABEL_W;
      const natural = viewDays * zoom.colW;
      setEffectiveColW(natural < available ? available / viewDays : zoom.colW);
    }
    recalc();
    const observer = new ResizeObserver(recalc);
    observer.observe(el);
    return () => observer.disconnect();
  }, [viewDays, zoom.colW]);

  // Navigation
  const navPrev = () => setViewStart((s) => Math.max(0, s - viewDays));
  const navNext = () => setViewStart((s) => Math.min(totalDays - viewDays, s + viewDays));
  const jumpToday = () => setViewStart(clamp(todayOff - Math.floor(viewDays / 2), 0, Math.max(0, totalDays - viewDays)));
  const showAll = () => { setZoomIdx(0); setViewStart(0); };

  // Rows in the order things happen: tasks by start, milestones by due date
  const when = (t: GanttTask) => dayOf(t.isMilestone ? t.dueDate : t.startDate);
  const rows = [...tasks].sort((a, b) => when(a) - when(b) || dayOf(a.dueDate) - dayOf(b.dueDate) || a.name.localeCompare(b.name));
  const keyTeams: (string | null)[] = [
    ...SUBTEAM_OPTIONS.map((o) => o.value).filter((v) => tasks.some((t) => t.subTeam === v)),
    ...(tasks.some((t) => !t.subTeam) ? [null] : []),
  ];

  // Header: a label at each week from kickoff (and day letters when there's room)
  const weekStarts: number[] = [];
  for (let d = Math.ceil(viewStart / 7) * 7; d <= viewEnd; d += 7) weekStarts.push(d);
  const shownMarkers = markers.filter((m) => m.day >= viewStart && m.day <= viewEnd);
  const dayLetters = colW >= 22;
  const headerH = 28 + (dayLetters ? 18 : 0) + (shownMarkers.length ? 22 : 0);

  // Background layers drawn once for all rows: weekends, day ticks, week ticks
  let firstSat = viewStart;
  while (weekday(firstSat) !== 6) firstSat--;
  const shade = "color-mix(in srgb, var(--color-text-primary) 5%, transparent)";
  const weekendBg = `repeating-linear-gradient(to right, ${shade} 0 ${colW * 2}px, transparent ${colW * 2}px ${colW * 7}px)`;
  const tickColor = "color-mix(in srgb, var(--color-text-secondary) 55%, transparent)";
  const dayTicksBg = `repeating-linear-gradient(to right, ${tickColor} 0 1px, transparent 1px ${colW}px)`;
  const weekTicksBg = `repeating-linear-gradient(to right, var(--color-text-secondary) 0 1.5px, transparent 1.5px ${colW * 7}px)`;
  const firstWeek = Math.ceil(viewStart / 7) * 7;
  const markerColor = (m: GanttMarker) => (m.kind === "week0" || m.kind === "end" ? "var(--color-primary)" : "var(--color-secondary)");

  return (
    <>
      {/* ── Controls ────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex rounded-md border border-(--color-border) overflow-hidden">
          {ZOOM_LEVELS.map((z, i) => (
            <button key={z.label} onClick={() => { setZoomIdx(i); setViewStart(0); }}
              className={`px-3 py-1.5 text-sm font-medium transition-colors border-r last:border-r-0 border-(--color-border) ${
                zoomIdx === i ? "text-white" : "text-(--color-text-secondary) hover:text-(--color-text-primary) bg-(--color-surface)"
              }`}
              style={zoomIdx === i ? { backgroundColor: "var(--color-primary)" } : undefined}>
              {z.label}
            </button>
          ))}
        </div>
        {zoomIdx > 0 && (
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" onClick={navPrev} disabled={viewStart === 0}>‹</Button>
            <span className="px-3 text-sm text-(--color-text-secondary) min-w-[140px] text-center">
              {short(viewStart)} – {short(viewEnd)}
            </span>
            <Button variant="outline" size="sm" onClick={navNext} disabled={viewEnd >= totalDays - 1}>›</Button>
          </div>
        )}
        <Button variant="outline" size="sm" onClick={jumpToday}>Today</Button>
        {zoomIdx > 0 && <Button variant="outline" size="sm" onClick={showAll}>Full season</Button>}
      </div>

      {/* ── Chart ───────────────────────────────────────────────────────── */}
      <div ref={containerRef} className="overflow-x-auto rounded-lg border border-(--color-border) bg-(--color-surface)" aria-label={`${seasonName} timeline`}>
        <div className="relative" style={{ width: LABEL_W + chartW, minWidth: "100%" }}>
          {/* Header: week dates, day letters, key dates */}
          <div className="relative border-b border-(--color-border)" style={{ height: headerH }}>
            <div className="absolute left-0 top-0 bottom-0 flex items-end px-3 pb-1.5 text-label font-medium text-(--color-text-secondary)" style={{ width: LABEL_W }}>
              Task
            </div>
            <div className="absolute top-0 bottom-0" style={{ left: LABEL_W, width: chartW }}>
              {weekStarts.map((d) => (
                <div key={d} className="absolute top-1.5 text-label text-(--color-text-secondary) whitespace-nowrap" style={{ left: x(d) + 4 }}>
                  {d === 0 ? "Kickoff" : short(d)}
                </div>
              ))}
              {dayLetters && Array.from({ length: shownDays }, (_, i) => viewStart + i).map((d) => (
                <div key={d} className="absolute text-[10px] text-center text-(--color-text-secondary)" style={{ left: x(d), width: colW, top: 26 }}>
                  {"SMTWTFS"[weekday(d)]}
                </div>
              ))}
              {shownMarkers.map((m, i) => (
                <div key={`${m.label}-${i}`} className="absolute text-[11px] font-bold whitespace-nowrap px-1"
                  style={{ left: x(m.day), bottom: 3, color: markerColor(m), borderLeft: `2px solid ${markerColor(m)}` }}>
                  {m.label}
                </div>
              ))}
            </div>
          </div>

          {/* Rows */}
          <div className="relative" onMouseLeave={() => setHover(null)} style={{ height: rows.length * ROW_H }}>
            {/* Background layers across every row */}
            <div className="absolute top-0 bottom-0 pointer-events-none" style={{ left: LABEL_W, width: chartW }}>
              <div className="absolute inset-0" style={{ backgroundImage: weekendBg, backgroundPositionX: x(firstSat) }} />
              {weekStarts.map((d) => <div key={d} className="absolute top-0 bottom-0" style={{ left: x(d), borderLeft: "1px solid color-mix(in srgb, var(--color-border) 70%, transparent)" }} />)}
              {shownMarkers.map((m, i) => <div key={`${m.label}-${i}`} className="absolute top-0 bottom-0" style={{ left: x(m.day), borderLeft: `2px solid ${markerColor(m)}`, opacity: 0.55 }} />)}
              {todayOff >= viewStart && todayOff <= viewEnd && (
                <div className="absolute top-0 bottom-0" style={{ left: x(todayOff) + colW / 2, borderLeft: "2px dashed var(--color-primary)" }} />
              )}
            </div>

            {rows.map((task, r) => {
              const s = dayOf(task.startDate);
              const d = dayOf(task.dueDate);
              const isDone = task.status === "COMPLETE";
              const isBlocked = task.status === "BLOCKED";
              const color = isBlocked ? "var(--color-danger)" : isDone ? "var(--color-success)" : teamColor(task.subTeam);
              const visible = d >= viewStart && (task.isMilestone ? d <= viewEnd : s <= viewEnd + 1);
              // Tasks fill their due day too (lengths count both ends); milestones sit on it
              const x1 = clamp(x(s), 0, chartW), x2 = clamp(x(task.isMilestone ? d : d + 1), 0, chartW);
              const tag = task.isMilestone ? short(d) : `${d - s + 1}d · due ${short(d)}`;
              const tagRight = x2 + 150 < chartW;
              const gap = task.isMilestone ? 14 : 8;
              return (
                <div key={task.id} className="absolute left-0 right-0 cursor-pointer"
                  style={{ top: r * ROW_H, height: ROW_H, background: hover?.task.id === task.id ? "color-mix(in srgb, var(--color-secondary) 9%, transparent)" : r % 2 ? "color-mix(in srgb, var(--color-text-primary) 2.5%, transparent)" : "transparent" }}
                  onMouseEnter={(e) => setHover({ task, x: e.clientX, y: e.clientY })}
                  onMouseMove={(e) => setHover({ task, x: e.clientX, y: e.clientY })}
                  onClick={() => setModalTask(task)}>
                  {/* Name */}
                  <div className="absolute left-0 top-0 bottom-0 flex items-center gap-2 px-3 bg-(--color-surface)/80" style={{ width: LABEL_W }}>
                    {/* One marker in the sub-team color: a dot for tasks, a diamond for milestones */}
                    {task.isMilestone
                      ? <span className="w-2 h-2 mx-px rotate-45 shrink-0" style={{ background: teamColor(task.subTeam) }} title="Milestone" />
                      : <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: teamColor(task.subTeam) }} />}
                    <span className={`text-small truncate ${task.isMilestone ? "font-semibold" : ""} ${isDone ? "line-through text-(--color-text-secondary)" : "text-(--color-text-primary)"}`}>
                      {task.name}
                    </span>
                  </div>
                  {/* Timeline */}
                  <div className="absolute top-0 bottom-0" style={{ left: LABEL_W, width: chartW }}>
                    {/* Day ticks along the bottom, taller at each week */}
                    {colW >= 4 && <div className="absolute left-0 right-0 bottom-0 h-1 pointer-events-none" style={{ backgroundImage: dayTicksBg }} />}
                    <div className="absolute left-0 right-0 bottom-0 h-2 pointer-events-none" style={{ backgroundImage: weekTicksBg, backgroundPositionX: x(firstWeek) }} />
                    {visible && (task.isMilestone ? (
                      <div className="absolute rotate-45" style={{ left: x2 - 7, top: ROW_H / 2 - 7, width: 14, height: 14, background: isDone ? "var(--color-success)" : MILESTONE }} />
                    ) : (
                      <div className="absolute rounded-full" style={{ left: x1, width: Math.max(colW * 0.5, x2 - x1), top: ROW_H * 0.24, height: ROW_H * 0.52, background: color }} />
                    ))}
                    {visible && (
                      <div className="absolute top-0 bottom-0 flex items-center text-label text-(--color-text-secondary) whitespace-nowrap pointer-events-none"
                        style={tagRight ? { left: x2 + gap } : { right: chartW - (task.isMilestone ? x2 : x1) + gap }}>
                        {tag}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Legend ──────────────────────────────────────────────────────── */}
      <div className="space-y-2 text-small text-(--color-text-secondary)">
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {keyTeams.map((t) => (
            <span key={t ?? "none"} className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: teamColor(t) }} />{teamLabel(t)}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <span className="flex items-center gap-1.5"><span className="inline-block w-6 h-2.5 rounded-full bg-(--color-secondary)" />Task: start → due</span>
          <span className="flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rotate-45" style={{ background: MILESTONE }} />Milestone</span>
          <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm bg-(--color-success)" />Complete</span>
          <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm bg-(--color-danger)" />Blocked</span>
          <span className="flex items-center gap-1.5"><span className="inline-block h-3" style={{ borderLeft: "2px dashed var(--color-primary)" }} />Today</span>
          <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3" style={{ background: shade }} />Weekend</span>
          <span>Hover a row for details · click to open</span>
        </div>
      </div>

      {/* ── Hover card ──────────────────────────────────────────────────── */}
      {hover && <HoverCard task={hover.task} x={hover.x} y={hover.y} long={long} dayOf={dayOf} />}

      {/* ── Task detail modal ───────────────────────────────────────────── */}
      <Dialog open={!!modalTask} onOpenChange={(o) => !o && setModalTask(null)}>
        {modalTask && (
          <DialogContent title={modalTask.name} className="sm:max-w-lg">
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant={STATUS_CONFIG[modalTask.status as keyof typeof STATUS_CONFIG]?.variant ?? "neutral"}>
                  {STATUS_CONFIG[modalTask.status as keyof typeof STATUS_CONFIG]?.label ?? modalTask.status}
                </Badge>
                <Badge variant={PRIORITY_CONFIG[modalTask.priority as keyof typeof PRIORITY_CONFIG]?.variant ?? "neutral"}>
                  {PRIORITY_CONFIG[modalTask.priority as keyof typeof PRIORITY_CONFIG]?.label ?? modalTask.priority}
                </Badge>
                {modalTask.subTeam && <Badge variant="neutral">{teamLabel(modalTask.subTeam)}</Badge>}
                {modalTask.isMilestone && <Badge variant="info">◆ Milestone</Badge>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-md bg-(--color-surface-overlay) px-3 py-2">
                  <p className="text-label text-(--color-text-secondary)">Start</p>
                  <p className="text-sm font-medium text-(--color-text-primary)">{formatDate(modalTask.startDate)}</p>
                </div>
                <div className="rounded-md bg-(--color-surface-overlay) px-3 py-2">
                  <p className="text-label text-(--color-text-secondary)">Due</p>
                  <p className="text-sm font-medium text-(--color-text-primary)">{formatDate(modalTask.dueDate)}</p>
                </div>
                {(modalTask.estimatedHours != null || modalTask.actualHours != null) && (
                  <div className="rounded-md bg-(--color-surface-overlay) px-3 py-2">
                    <p className="text-label text-(--color-text-secondary)">Hours</p>
                    <p className="text-sm font-medium text-(--color-text-primary)">
                      {modalTask.actualHours ?? "—"} / {modalTask.estimatedHours ?? "—"} est.
                    </p>
                  </div>
                )}
              </div>
              {modalTask.assignees.length > 0 && (
                <div>
                  <p className="text-label text-(--color-text-secondary) mb-1.5">Assigned to</p>
                  <div className="flex flex-wrap gap-1.5">
                    {modalTask.assignees.map((a) => (
                      <span key={a.name} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-(--color-surface-overlay) text-sm text-(--color-text-primary)">
                        <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: "var(--color-primary)" }}>
                          {a.name[0].toUpperCase()}
                        </span>
                        {a.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {modalTask.details && (
                <div>
                  <p className="text-label text-(--color-text-secondary) mb-1">Details</p>
                  <div className="rounded-md border border-(--color-border) px-3 py-2.5 max-h-80 overflow-y-auto">
                    <Markdown>{modalTask.details}</Markdown>
                  </div>
                </div>
              )}
              {modalTask.blockersNotes && (
                <div className="rounded-md bg-(--color-danger)/10 border border-(--color-danger)/20 px-3 py-2">
                  <p className="text-label text-(--color-danger) mb-0.5">Blockers</p>
                  <p className="text-sm text-(--color-text-primary)">{modalTask.blockersNotes}</p>
                </div>
              )}
              <Link href={`/tasks?mine=0&task=${modalTask.id}`} onClick={() => setModalTask(null)}
                className="inline-flex items-center gap-1 text-sm text-(--color-secondary) hover:underline">
                Open in Tasks →
              </Link>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}

/** Everything about one row — full name (even when the row cuts it off), dates, people */
function HoverCard({ task: t, x, y, long, dayOf }: {
  task: GanttTask; x: number; y: number; long: (day: number) => string; dayOf: (iso: string) => number;
}) {
  const s = dayOf(t.startDate), d = dayOf(t.dueDate);
  // Keep it on screen: flip left/up near the right/bottom edges
  const W = 340;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const left = x + 16 + W > vw ? x - W - 16 : x + 16;
  const flipUp = y > vh * 0.6;
  const line = (label: string, value: React.ReactNode) => (
    <div className="flex gap-2.5"><span className="w-20 shrink-0 text-slate-400">{label}</span><span>{value}</span></div>
  );
  const status = STATUS_CONFIG[t.status as keyof typeof STATUS_CONFIG]?.label ?? t.status.replace(/_/g, " ").toLowerCase();
  return (
    <div className="fixed z-50 pointer-events-none rounded-xl px-4 py-3 text-sm leading-relaxed text-white shadow-2xl border border-white/10"
      style={{ left, width: W, background: "#0f172a", ...(flipUp ? { bottom: vh - y + 12 } : { top: y + 12 }) }}>
      <p className="text-base font-bold leading-snug mb-1.5">{t.isMilestone ? "◆ " : ""}{t.name}</p>
      {line("Sub-team", <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: teamColor(t.subTeam) }} />{teamLabel(t.subTeam)}</span>)}
      {t.isMilestone
        ? line("Due", long(d))
        : <>{line("Starts", long(s))}{line("Due", `${long(d)} · ${d - s} day${d - s === 1 ? "" : "s"}`)}</>}
      {line("Status", status)}
      {t.assignees.length > 0 && line("People", t.assignees.map((a) => a.name).join(", "))}
      {(t.estimatedHours != null || t.actualHours != null) && line("Hours", `${t.actualHours ?? 0} of ${t.estimatedHours ?? "—"} est.`)}
      {t.blockersNotes && line("Blocked", t.blockersNotes)}
    </div>
  );
}
