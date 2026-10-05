"use client";

import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { updateProfileAction } from "@/app/actions/profile";
import { useTheme, COLOR_THEMES } from "@/components/providers/ThemeProvider";
import type { ColorTheme, BgMode } from "@/components/providers/ThemeProvider";
import { useKanbanStyle, STICKY_COLORS, type KanbanCardStyle } from "@/lib/kanban-style";

interface Props {
  initialName: string;
  initialEmail: string;
}

const BG_MODES: { id: BgMode; label: string; desc: string }[] = [
  { id: "theme",  label: "Animated orbs",  desc: "Floating orbs using your theme colors" },
  { id: "solid",  label: "Single color",   desc: "Flat solid background color" },
  { id: "custom", label: "Custom orbs",    desc: "Animated orbs with your own two colors" },
];

export function ProfileForm({ initialName, initialEmail }: Props) {
  const {
    colorTheme, setColorTheme,
    mode, setMode,
    bgMode, setBgMode,
    bgColor1, setBgColor1,
    bgColor2, setBgColor2,
    bgSolidColor, setBgSolidColor,
  } = useTheme();

  const [state, action, isPending] = useActionState(updateProfileAction, null);
  // Guard: don't show selected states until localStorage values are loaded
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  function activeClass(isActive: boolean) {
    return isActive && mounted
      ? "border-[--color-primary] text-white shadow-sm"   // solid fill applied via inline style below
      : "border-[--color-border] text-[--color-text-secondary] hover:border-[--color-border-strong] hover:text-[--color-text-primary] bg-transparent";
  }

  function activeStyle(isActive: boolean): React.CSSProperties {
    return isActive && mounted ? { backgroundColor: "var(--color-primary)" } : {};
  }

  function activeCardClass(isActive: boolean) {
    return isActive && mounted
      ? "border-[--color-primary] shadow-sm"
      : "border-[--color-border] hover:border-[--color-border-strong]";
  }

  function activeCardStyle(isActive: boolean): React.CSSProperties {
    return isActive && mounted
      ? { backgroundColor: "color-mix(in srgb, var(--color-primary) 12%, var(--color-surface))" }
      : {};
  }

  return (
    <div className="space-y-8">

      {/* Personal info */}
      <div className="card space-y-5">
        <h2 className="text-h3 text-[--color-text-primary]">Personal information</h2>

        {state?.success && (
          <div className="text-sm text-[--color-success] bg-[--color-success]/10 rounded px-3 py-2">
            Profile updated successfully.
          </div>
        )}
        {state && !state.success && (
          <div className="text-sm text-[--color-danger] bg-[--color-danger]/10 rounded px-3 py-2">
            {state.error}
          </div>
        )}

        <form action={action} className="space-y-4">
          <Field label="Display name"  name="name"  required defaultValue={initialName} />
          <Field label="Email address" name="email" type="email" required defaultValue={initialEmail} />
          <Button type="submit" isLoading={isPending}>Save changes</Button>
        </form>
      </div>

      {/* Appearance */}
      <div className="card space-y-6">
        <h2 className="text-h3 text-[--color-text-primary]">Appearance</h2>

        {/* Display mode */}
        <div>
          <p className="text-sm font-medium text-[--color-text-primary] mb-3">Display mode</p>
          <div className="flex flex-wrap gap-2">
            {(
              [
                { value: "LIGHT",       label: "Light" },
                { value: "DARK",        label: "Dark" },
                { value: "AUTO_SYSTEM", label: "System" },
                { value: "AUTO_TIME",   label: "Auto (time of day)" },
              ] as const
            ).map((opt) => {
              const isActive = mode === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => setMode(opt.value)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all flex items-center gap-1.5 ${activeClass(isActive)}`}
                  style={activeStyle(isActive)}
                >
                  {isActive && mounted && (
                    <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/>
                    </svg>
                  )}
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Background style */}
        <div>
          <p className="text-sm font-medium text-[--color-text-primary] mb-3">Background</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            {BG_MODES.map((opt) => {
              const isActive = bgMode === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => setBgMode(opt.id)}
                  className={`relative p-3 rounded-xl border transition-all text-left ${activeCardClass(isActive)}`}
                  style={activeCardStyle(isActive)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-[--color-text-primary]">{opt.label}</p>
                    {isActive && mounted && (
                      <svg className="w-4 h-4 shrink-0" style={{ color: "var(--color-primary)" }} viewBox="0 0 16 16" fill="currentColor">
                        <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/>
                      </svg>
                    )}
                  </div>
                  <p className="text-xs text-[--color-text-secondary] mt-0.5">{opt.desc}</p>
                </button>
              );
            })}
          </div>

          {/* Solid color picker */}
          {bgMode === "solid" && (
            <div className="flex items-center gap-3 p-3 rounded-lg border border-[--color-border] bg-[--color-surface-overlay]">
              <label className="text-sm text-[--color-text-secondary] shrink-0">Color</label>
              <input
                type="color"
                value={bgSolidColor}
                onChange={(e) => setBgSolidColor(e.target.value)}
                className="w-10 h-8 rounded cursor-pointer border border-[--color-border] bg-transparent p-0.5"
              />
              <span className="text-sm font-mono text-[--color-text-secondary]">{bgSolidColor}</span>
            </div>
          )}

          {/* Custom orb pickers */}
          {bgMode === "custom" && (
            <div className="flex flex-wrap gap-4 p-3 rounded-lg border border-[--color-border] bg-[--color-surface-overlay]">
              <div className="flex items-center gap-2">
                <label className="text-sm text-[--color-text-secondary] shrink-0">Orb 1</label>
                <input
                  type="color"
                  value={bgColor1}
                  onChange={(e) => setBgColor1(e.target.value)}
                  className="w-10 h-8 rounded cursor-pointer border border-[--color-border] bg-transparent p-0.5"
                />
                <span className="text-sm font-mono text-[--color-text-secondary]">{bgColor1}</span>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-[--color-text-secondary] shrink-0">Orb 2</label>
                <input
                  type="color"
                  value={bgColor2}
                  onChange={(e) => setBgColor2(e.target.value)}
                  className="w-10 h-8 rounded cursor-pointer border border-[--color-border] bg-transparent p-0.5"
                />
                <span className="text-sm font-mono text-[--color-text-secondary]">{bgColor2}</span>
              </div>
            </div>
          )}
        </div>

        {/* Kanban task cards */}
        <TaskCardStyle mounted={mounted} />

        {/* Color theme */}
        <div>
          <p className="text-sm font-medium text-[--color-text-primary] mb-3">Color theme</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {COLOR_THEMES.map((theme) => {
              const isActive = colorTheme === theme.id;
              return (
                <button
                  key={theme.id}
                  onClick={() => setColorTheme(theme.id as ColorTheme)}
                  className={`relative flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${activeCardClass(isActive)}`}
                  style={activeCardStyle(isActive)}
                >
                  <div className="flex gap-1 shrink-0">
                    <div className="w-5 h-5 rounded-full border border-white/30" style={{ backgroundColor: theme.primary }} />
                    <div className="w-5 h-5 rounded-full border border-white/30" style={{ backgroundColor: theme.secondary }} />
                  </div>
                  <span className="text-sm font-medium text-[--color-text-primary] truncate flex-1">{theme.label}</span>
                  {isActive && mounted && (
                    <svg className="w-4 h-4 shrink-0" style={{ color: "var(--color-primary)" }} viewBox="0 0 16 16" fill="currentColor">
                      <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/>
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

const CARD_STYLES: { id: KanbanCardStyle; label: string; desc: string }[] = [
  { id: "plain",   label: "Plain cards",            desc: "Clean cards with a sub-team stripe" },
  { id: "rainbow", label: "Sticky notes — rainbow", desc: "Each task on its own colour of note" },
  { id: "single",  label: "Sticky notes — one colour", desc: "Every note the same colour you pick" },
];

/** Kanban board card look — saved on this device. */
function TaskCardStyle({ mounted }: { mounted: boolean }) {
  const { style, color, setStyle, setColor } = useKanbanStyle();

  return (
    <div>
      <p className="text-sm font-medium text-(--color-text-primary) mb-3">Task cards on the Kanban board</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {CARD_STYLES.map((opt) => {
          const on = mounted && style === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => setStyle(opt.id)}
              aria-pressed={on}
              className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${on ? "border-(--color-primary) shadow-sm" : "border-(--color-border) hover:border-(--color-border-strong)"}`}
              style={on ? { backgroundColor: "color-mix(in srgb, var(--color-primary) 12%, var(--color-surface))" } : undefined}
            >
              <CardPreview kind={opt.id} color={STICKY_COLORS.find((c) => c.id === color)!.hex} />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-(--color-text-primary)">{opt.label}</span>
                <span className="block text-xs text-(--color-text-secondary) mt-0.5">{opt.desc}</span>
              </span>
            </button>
          );
        })}
      </div>

      {mounted && style === "single" && (
        <div className="mt-3 flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Sticky note colour">
          <span className="text-sm text-(--color-text-secondary) mr-1">Note colour</span>
          {STICKY_COLORS.map((c) => (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={color === c.id}
              aria-label={c.label}
              title={c.label}
              onClick={() => setColor(c.id)}
              className="flex h-11 w-11 items-center justify-center"
            >
              <span
                className={`block h-7 w-7 rounded-sm shadow-sm transition-transform ${color === c.id ? "ring-2 ring-(--color-primary) ring-offset-2 ring-offset-(--color-surface) scale-110" : ""}`}
                style={{ backgroundColor: c.hex }}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Tiny picture of the card style */
function CardPreview({ kind, color }: { kind: KanbanCardStyle; color: string }) {
  if (kind === "plain") {
    return (
      <span aria-hidden className="block h-10 w-10 shrink-0 rounded-md border border-(--color-border) bg-(--color-surface-raised)"
        style={{ borderLeftWidth: 3, borderLeftColor: "var(--color-primary)" }} />
    );
  }
  const notes = kind === "rainbow" ? [STICKY_COLORS[1].hex, STICKY_COLORS[2].hex, STICKY_COLORS[0].hex] : [color, color, color];
  return (
    <span aria-hidden className="relative block h-10 w-10 shrink-0">
      {notes.map((hex, i) => (
        <span key={i} className="sticky-note-wrap absolute h-7 w-7"
          style={{ left: i * 6, top: i * 5, transform: `rotate(${[-6, 3, -2][i]}deg)` }}>
          <span className="sticky-note block h-full w-full" style={{ "--note": hex, "--fold": "7px" } as React.CSSProperties} />
        </span>
      ))}
    </span>
  );
}
