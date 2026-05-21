"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { SUBTEAM_COLORS, STATUS_CONFIG, PRIORITY_CONFIG } from "@/lib/schedule-helpers";
import { formatDate } from "@/lib/utils";

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
  description: string | null;
  blockersNotes: string | null;
  estimatedHours: number | null;
  actualHours: number | null;
  assignees: { name: string }[];
}

export interface GanttProps {
  tasks: GanttTask[];
  kickoffDate: string;
  week0Date: string;
  meetingDays: string[];
  seasonName: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function daysBetween(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}
function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}
function isBuildDay(date: Date, meetingDays: string[]) {
  const MAP: Record<string, number> = { SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6 };
  return meetingDays.some((d) => MAP[d] === date.getDay());
}

const ZOOM_LEVELS = [
  { label: "Season", colW: 12 },
  { label: "2 weeks", colW: 28 },
  { label: "1 week",  colW: 56 },
];

// ─── Component ────────────────────────────────────────────────────────────────
export function GanttClient({ tasks, kickoffDate, week0Date, meetingDays, seasonName }: GanttProps) {
  const kickoff   = new Date(kickoffDate);
  const week0     = new Date(week0Date);
  const totalDays = daysBetween(kickoff, week0) + 1;
  const today     = new Date();
  const todayOff  = clamp(daysBetween(kickoff, today), 0, totalDays);

  // ── State ──────────────────────────────────────────────────────────────────
  const [zoomIdx,      setZoomIdx]     = useState(1);
  const [viewStart,    setViewStart]   = useState(0);
  const [modalTask,    setModalTask]   = useState<GanttTask | null>(null);
  const [tooltip,      setTooltip]     = useState<{ task: GanttTask; x: number; y: number } | null>(null);
  const [effectiveColW, setEffectiveColW] = useState(ZOOM_LEVELS[1].colW);
  const containerRef = useRef<HTMLDivElement>(null);

  const baseColW  = ZOOM_LEVELS[zoomIdx].colW;
  const viewDays  = ZOOM_LEVELS[zoomIdx].label === "Season"  ? totalDays
                  : ZOOM_LEVELS[zoomIdx].label === "2 weeks" ? 14
                  : 7;
  const viewEnd   = Math.min(viewStart + viewDays - 1, totalDays - 1);
  const colW      = effectiveColW; // actual px/day used for rendering

  // Stretch colW to fill container width when natural size is smaller
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    function recalc() {
      if (!el) return;
      const available = el.clientWidth - LABEL_W;
      const natural   = viewDays * baseColW;
      setEffectiveColW(natural < available ? available / viewDays : baseColW);
    }

    recalc();
    const observer = new ResizeObserver(recalc);
    observer.observe(el);
    return () => observer.disconnect();
  }, [viewDays, baseColW]);

  // Days actually rendered
  const days: Date[] = [];
  for (let i = viewStart; i <= viewEnd; i++) {
    const d = new Date(kickoff);
    d.setDate(d.getDate() + i);
    days.push(d);
  }

  // Week header buckets
  const weeks: { label: string; start: number; width: number }[] = [];
  days.forEach((d, i) => {
    if (d.getDay() === 1 || i === 0) {
      if (weeks.length > 0) weeks[weeks.length - 1].width = i - weeks[weeks.length - 1].start;
      weeks.push({ label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }), start: i, width: 0 });
    }
  });
  if (weeks.length > 0) weeks[weeks.length - 1].width = days.length - weeks[weeks.length - 1].start;

  // Navigation
  function navPrev() {
    setViewStart((s) => Math.max(0, s - viewDays));
  }
  function navNext() {
    setViewStart((s) => Math.min(totalDays - 1 - viewDays + 1, s + viewDays));
  }
  function jumpToday() {
    setViewStart(clamp(todayOff - Math.floor(viewDays / 2), 0, Math.max(0, totalDays - viewDays)));
  }
  function showAll() {
    setZoomIdx(0);
    setViewStart(0);
  }

  // Group tasks
  const groups: Record<string, GanttTask[]> = {};
  for (const t of tasks) {
    const key = t.subTeam ?? "OTHER";
    if (!groups[key]) groups[key] = [];
    groups[key].push(t);
  }

  // Tooltip handlers
  const handleBarEnter = useCallback((e: React.MouseEvent, task: GanttTask) => {
    setTooltip({ task, x: e.clientX, y: e.clientY });
  }, []);
  const handleBarMove = useCallback((e: React.MouseEvent) => {
    setTooltip((t) => t ? { ...t, x: e.clientX, y: e.clientY } : null);
  }, []);
  const handleBarLeave = useCallback(() => setTooltip(null), []);

  // Bar geometry (relative to view)
  function barGeom(task: GanttTask) {
    if (!task.startDate || !task.dueDate) return null;
    const taskStart = daysBetween(kickoff, new Date(task.startDate));
    const taskEnd   = daysBetween(kickoff, new Date(task.dueDate));
    // Clip to view
    const visStart = Math.max(taskStart, viewStart);
    const visEnd   = Math.min(taskEnd, viewEnd);
    if (visEnd < viewStart || visStart > viewEnd) return null; // off screen
    const left  = (visStart - viewStart) * colW;
    const width = Math.max((visEnd - visStart + 1) * colW, colW);
    return { left, width, taskStart, taskEnd };
  }

  const LABEL_W = 200; // name column width

  return (
    <>
      {/* ── Controls ────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 mb-4 px-4 sm:px-6 lg:px-8">
        {/* Zoom buttons */}
        <div className="flex rounded-md border border-[--color-border] overflow-hidden">
          {ZOOM_LEVELS.map((z, i) => (
            <button key={z.label} onClick={() => { setZoomIdx(i); setViewStart(0); }}
              className={`px-3 py-1.5 text-sm font-medium transition-colors border-r last:border-r-0 border-[--color-border] ${
                zoomIdx === i
                  ? "text-white"
                  : "text-[--color-text-secondary] hover:text-[--color-text-primary] bg-[--color-surface]"
              }`}
              style={zoomIdx === i ? { backgroundColor: "var(--color-primary)" } : undefined}>
              {z.label}
            </button>
          ))}
        </div>

        {/* Week navigation — hidden in season view */}
        {zoomIdx > 0 && (
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" onClick={navPrev} disabled={viewStart === 0}>‹</Button>
            <span className="px-3 text-sm text-[--color-text-secondary] min-w-[140px] text-center">
              {days[0]?.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              {" – "}
              {days[days.length - 1]?.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </span>
            <Button variant="outline" size="sm" onClick={navNext} disabled={viewEnd >= totalDays - 1}>›</Button>
          </div>
        )}

        <Button variant="outline" size="sm" onClick={jumpToday}>Today</Button>
        {zoomIdx > 0 && <Button variant="outline" size="sm" onClick={showAll}>Full season</Button>}
      </div>

      {/* ── Gantt grid ──────────────────────────────────────────────────── */}
      <div ref={containerRef} className="overflow-x-auto" style={{ borderTop: "1px solid var(--color-border)", borderBottom: "1px solid var(--color-border)" }}>
        <div style={{ minWidth: `${LABEL_W + days.length * colW}px` }}>

          {/* Header row */}
          <div className="flex bg-[--color-surface-raised]" style={{ height: 36, borderBottom: "1px solid color-mix(in srgb, var(--color-border) 60%, transparent)" }}>
            <div className="shrink-0 px-3 flex items-center text-label font-medium text-[--color-text-secondary]"
              style={{ width: LABEL_W, borderRight: "1px solid color-mix(in srgb, var(--color-border) 50%, transparent)" }}>
              Task
            </div>
            <div className="flex-1 relative">
              {weeks.map((w, i) => (
                <div key={i} className="absolute top-0 bottom-0 flex items-center px-2 text-label text-[--color-text-secondary]"
                  style={{ left: w.start * colW, width: w.width * colW, borderRight: "1px solid color-mix(in srgb, var(--color-border) 30%, transparent)" }}>
                  {w.label}
                </div>
              ))}
              {todayOff >= viewStart && todayOff <= viewEnd && (
                <div className="absolute top-0 bottom-0 w-px bg-[--color-primary]"
                  style={{ left: (todayOff - viewStart) * colW }} />
              )}
            </div>
          </div>

          {/* Sub-team groups */}
          {Object.entries(groups).map(([st, groupTasks]) => {
            const color = SUBTEAM_COLORS[st] ?? "#64748B";
            return (
              <div key={st}>
                {/* Group header */}
                <div className="flex bg-[--color-surface-overlay]" style={{ height: 26, borderBottom: "1px solid color-mix(in srgb, var(--color-border) 50%, transparent)" }}>
                  <div className="shrink-0 px-3 flex items-center" style={{ width: LABEL_W, borderRight: "1px solid color-mix(in srgb, var(--color-border) 50%, transparent)" }}>
                    <span className="text-label font-semibold" style={{ color }}>{st.replace("_", " ")}</span>
                  </div>
                  <div className="flex-1 relative">
                    {days.map((d, i) => !isBuildDay(d, meetingDays) && (
                      <div key={i} className="absolute inset-y-0 opacity-50 bg-[--color-surface-overlay]"
                        style={{ left: i * colW, width: colW }} />
                    ))}
                  </div>
                </div>

                {/* Task rows */}
                {groupTasks.map((task) => {
                  const geom = barGeom(task);
                  const isDone    = task.status === "COMPLETE";
                  const isBlocked = task.status === "BLOCKED";
                  const barColor  = isBlocked ? "var(--color-danger)" : isDone ? "var(--color-success)" : color;

                  return (
                    <div key={task.id} className="flex hover:bg-[--color-surface-raised] transition-colors" style={{ height: 36, borderBottom: "1px solid color-mix(in srgb, var(--color-border) 25%, transparent)" }}>
                      {/* Name */}
                      <div className="shrink-0 px-3 flex items-center gap-1.5" style={{ width: LABEL_W, borderRight: "1px solid color-mix(in srgb, var(--color-border) 40%, transparent)" }}>
                        {task.isMilestone && <span className="text-[--color-primary] text-xs shrink-0">◆</span>}
                        <Link href={`/tasks/${task.id}`}
                          className="text-small text-[--color-text-primary] hover:text-[--color-primary] truncate">
                          {task.name}
                        </Link>
                      </div>

                      {/* Timeline */}
                      <div className="flex-1 relative">
                        {/* Non-build day shading */}
                        {days.map((d, i) => !isBuildDay(d, meetingDays) && (
                          <div key={i} className="absolute inset-y-0 opacity-40 bg-[--color-surface-overlay]"
                            style={{ left: i * colW, width: colW }} />
                        ))}
                        {/* Today line */}
                        {todayOff >= viewStart && todayOff <= viewEnd && (
                          <div className="absolute inset-y-0 w-px bg-[--color-primary]/30"
                            style={{ left: (todayOff - viewStart) * colW }} />
                        )}

                        {/* Bar / milestone */}
                        {geom && (
                          task.isMilestone ? (
                            <div
                              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rotate-45 cursor-pointer"
                              style={{ left: geom.left + colW / 2, backgroundColor: barColor, borderColor: barColor }}
                              onClick={() => setModalTask(task)}
                              onMouseEnter={(e) => handleBarEnter(e, task)}
                              onMouseMove={handleBarMove}
                              onMouseLeave={handleBarLeave}
                            />
                          ) : (
                            <div
                              className="absolute top-1.5 bottom-1.5 rounded cursor-pointer flex items-center px-1.5 overflow-hidden select-none"
                              style={{ left: geom.left, width: geom.width, backgroundColor: barColor + "D0" }}
                              onClick={() => setModalTask(task)}
                              onMouseEnter={(e) => handleBarEnter(e, task)}
                              onMouseMove={handleBarMove}
                              onMouseLeave={handleBarLeave}
                            >
                              <span className="text-white text-xs font-medium truncate leading-none">
                                {task.name}
                              </span>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}

          {/* Week 0 footer */}
          <div className="flex bg-[--color-surface-raised]" style={{ height: 26, borderTop: "1px solid color-mix(in srgb, var(--color-border) 60%, transparent)" }}>
            <div className="shrink-0 px-3 flex items-center" style={{ width: LABEL_W, borderRight: "1px solid color-mix(in srgb, var(--color-border) 50%, transparent)" }}>
              <span className="text-label font-semibold text-[--color-primary]">Week 0</span>
            </div>
            <div className="flex-1 relative">
              {totalDays - 1 >= viewStart && totalDays - 1 <= viewEnd && (
                <>
                  <div className="absolute inset-y-0 w-0.5 bg-[--color-primary]"
                    style={{ left: (totalDays - 1 - viewStart) * colW }} />
                  <span className="absolute top-1/2 -translate-y-1/2 text-label text-[--color-primary] font-bold"
                    style={{ left: (totalDays - 1 - viewStart) * colW + 6 }}>
                    Robot done
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Legend ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-4 text-small text-[--color-text-secondary] px-4 sm:px-6 lg:px-8">
        <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm bg-[--color-success]" />Complete</span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm bg-[--color-danger]" />Blocked</span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-px h-3 bg-[--color-primary]" />Today</span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 bg-[--color-surface-overlay]" />Non-build day</span>
        <span className="flex items-center gap-1.5">◆ Milestone · Click any task to view details</span>
      </div>

      {/* ── Hover tooltip ───────────────────────────────────────────────── */}
      {tooltip && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{ left: tooltip.x + 14, top: tooltip.y - 8 }}
        >
          <div className="rounded-lg border border-[--color-border] shadow-xl px-3 py-2.5 max-w-xs"
            style={{ backgroundColor: "var(--color-surface)" }}>
            <p className="text-sm font-semibold text-[--color-text-primary] mb-1">{tooltip.task.name}</p>
            <div className="space-y-0.5 text-small text-[--color-text-secondary]">
              <p>{formatDate(tooltip.task.startDate)} → {formatDate(tooltip.task.dueDate)}</p>
              {tooltip.task.assignees.length > 0 && (
                <p>👤 {tooltip.task.assignees.map((a) => a.name).join(", ")}</p>
              )}
              <p className="capitalize">{tooltip.task.status.replace(/_/g, " ").toLowerCase()}</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Task detail modal ───────────────────────────────────────────── */}
      <Dialog open={!!modalTask} onOpenChange={(o) => !o && setModalTask(null)}>
        {modalTask && (
          <DialogContent title={modalTask.name} className="sm:max-w-lg">
            <div className="space-y-4">
              {/* Badges */}
              <div className="flex flex-wrap gap-2">
                <Badge variant={STATUS_CONFIG[modalTask.status as keyof typeof STATUS_CONFIG]?.variant ?? "neutral"}>
                  {STATUS_CONFIG[modalTask.status as keyof typeof STATUS_CONFIG]?.label ?? modalTask.status}
                </Badge>
                <Badge variant={PRIORITY_CONFIG[modalTask.priority as keyof typeof PRIORITY_CONFIG]?.variant ?? "neutral"}>
                  {PRIORITY_CONFIG[modalTask.priority as keyof typeof PRIORITY_CONFIG]?.label ?? modalTask.priority}
                </Badge>
                {modalTask.subTeam && <Badge variant="neutral">{modalTask.subTeam.replace(/_/g, " ")}</Badge>}
                {modalTask.isMilestone && <Badge variant="info">◆ Milestone</Badge>}
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-md bg-[--color-surface-overlay] px-3 py-2">
                  <p className="text-label text-[--color-text-secondary]">Start</p>
                  <p className="text-sm font-medium text-[--color-text-primary]">{formatDate(modalTask.startDate)}</p>
                </div>
                <div className="rounded-md bg-[--color-surface-overlay] px-3 py-2">
                  <p className="text-label text-[--color-text-secondary]">Due</p>
                  <p className="text-sm font-medium text-[--color-text-primary]">{formatDate(modalTask.dueDate)}</p>
                </div>
                {(modalTask.estimatedHours != null || modalTask.actualHours != null) && (
                  <div className="rounded-md bg-[--color-surface-overlay] px-3 py-2">
                    <p className="text-label text-[--color-text-secondary]">Hours</p>
                    <p className="text-sm font-medium text-[--color-text-primary]">
                      {modalTask.actualHours ?? "—"} / {modalTask.estimatedHours ?? "—"} est.
                    </p>
                  </div>
                )}
              </div>

              {/* Assignees */}
              {modalTask.assignees.length > 0 && (
                <div>
                  <p className="text-label text-[--color-text-secondary] mb-1.5">Assigned to</p>
                  <div className="flex flex-wrap gap-1.5">
                    {modalTask.assignees.map((a) => (
                      <span key={a.name}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[--color-surface-overlay] text-sm text-[--color-text-primary]">
                        <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white"
                          style={{ backgroundColor: "var(--color-primary)" }}>
                          {a.name[0].toUpperCase()}
                        </span>
                        {a.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Description */}
              {modalTask.description && (
                <div>
                  <p className="text-label text-[--color-text-secondary] mb-1">Description</p>
                  <p className="text-sm text-[--color-text-primary] whitespace-pre-wrap">{modalTask.description}</p>
                </div>
              )}

              {/* Blockers */}
              {modalTask.blockersNotes && (
                <div className="rounded-md bg-[--color-danger]/10 border border-[--color-danger]/20 px-3 py-2">
                  <p className="text-label text-[--color-danger] mb-0.5">Blockers</p>
                  <p className="text-sm text-[--color-text-primary]">{modalTask.blockersNotes}</p>
                </div>
              )}

              {/* Open full detail */}
              <Link href={`/tasks/${modalTask.id}`} onClick={() => setModalTask(null)}
                className="inline-flex items-center gap-1 text-sm text-[--color-secondary] hover:underline">
                Open full task →
              </Link>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}

