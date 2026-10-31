"use client";

// How Kanban task cards look — a per-device setting (Settings → Profile & appearance → Task board).

import { useSyncExternalStore } from "react";

/** "rainbow" is stored for the by-sub-team notes (it used to mean a random color per task) */
export type KanbanCardStyle = "plain" | "rainbow" | "single";

/** Sticky-note paper colors (light enough for dark text in either theme) */
export const STICKY_COLORS = [
  { id: "yellow", label: "Yellow", hex: "#FFE97A" },
  { id: "pink",   label: "Pink",   hex: "#FFB8D2" },
  { id: "blue",   label: "Blue",   hex: "#AEDBFF" },
  { id: "green",  label: "Green",  hex: "#BDF2AE" },
  { id: "orange", label: "Orange", hex: "#FFCB8E" },
  { id: "purple", label: "Purple", hex: "#D9C6FF" },
] as const;
export type StickyColorId = (typeof STICKY_COLORS)[number]["id"];

const STYLE_KEY = "frc-kanban-style";
const COLOR_KEY = "frc-kanban-color";
const EVENT     = "frc-kanban-style-change";

function read(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(EVENT, onChange);
  return () => { window.removeEventListener("storage", onChange); window.removeEventListener(EVENT, onChange); };
}

// Default: sticky notes in each sub-team's color (until someone picks another style)
const snapshot       = () => `${read(STYLE_KEY) ?? "rainbow"}|${read(COLOR_KEY) ?? "yellow"}`;
const serverSnapshot = () => "rainbow|yellow";

function save(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* private mode — just this visit */ }
  window.dispatchEvent(new Event(EVENT));
}

export function useKanbanStyle() {
  const [rawStyle, rawColor] = useSyncExternalStore(subscribe, snapshot, serverSnapshot).split("|");
  const style: KanbanCardStyle = rawStyle === "plain" || rawStyle === "single" ? rawStyle : "rainbow";
  const color = (STICKY_COLORS.some((c) => c.id === rawColor) ? rawColor : "yellow") as StickyColorId;
  return {
    style,
    color,
    setStyle: (s: KanbanCardStyle) => save(STYLE_KEY, s),
    setColor: (c: StickyColorId) => save(COLOR_KEY, c),
  };
}

/** Small stable number from a task id, so each note keeps its color and tilt */
function hash(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** A sub-team's color as sticky-note paper: light enough for dark text */
export function subTeamNote(subTeamHex: string): string {
  return `color-mix(in srgb, ${subTeamHex} 38%, #fff)`;
}

/**
 * A note's paper and tilt. By sub-team: the sub-team's color (yellow when it has none);
 * one color: the color picked.
 */
export function stickyNoteLook(taskId: string, style: KanbanCardStyle, color: StickyColorId, subTeamHex?: string | null) {
  const h = hash(taskId);
  const hex = style === "rainbow"
    ? (subTeamHex ? subTeamNote(subTeamHex) : STICKY_COLORS[0].hex)
    : STICKY_COLORS.find((c) => c.id === color)!.hex;
  const tilt = ((h >> 3) % 5 - 2) * 0.6; // -1.2° … 1.2°
  return { hex, tilt };
}
