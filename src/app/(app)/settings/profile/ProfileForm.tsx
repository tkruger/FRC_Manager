"use client";

import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { updateProfileAction } from "@/app/actions/profile";
import { useTheme, COLOR_THEMES } from "@/components/providers/ThemeProvider";
import type { ColorTheme, BgMode } from "@/components/providers/ThemeProvider";

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
      ? "border-[--color-primary] bg-[--color-primary]/10 text-[--color-primary]"
      : "border-[--color-border] text-[--color-text-secondary] hover:border-[--color-border-strong] hover:text-[--color-text-primary]";
  }

  function activeCardClass(isActive: boolean) {
    return isActive && mounted
      ? "border-[--color-primary] bg-[--color-surface-overlay] shadow-sm"
      : "border-[--color-border] hover:border-[--color-border-strong]";
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
          <p className="text-label font-medium text-[--color-text-primary] mb-3">Display mode</p>
          <div className="flex flex-wrap gap-2">
            {(
              [
                { value: "LIGHT",       label: "Light" },
                { value: "DARK",        label: "Dark" },
                { value: "AUTO_SYSTEM", label: "System" },
                { value: "AUTO_TIME",   label: "Auto (time of day)" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.value}
                onClick={() => setMode(opt.value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${activeClass(mode === opt.value)}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Background style */}
        <div>
          <p className="text-label font-medium text-[--color-text-primary] mb-3">Background</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            {BG_MODES.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setBgMode(opt.id)}
                className={`relative p-3 rounded-xl border transition-all text-left ${activeCardClass(bgMode === opt.id)}`}
              >
                <p className="text-sm font-medium text-[--color-text-primary]">{opt.label}</p>
                <p className="text-xs text-[--color-text-secondary] mt-0.5">{opt.desc}</p>
                {bgMode === opt.id && mounted && (
                  <span className="absolute top-2 right-2 w-2 h-2 rounded-full" style={{ backgroundColor: "var(--color-primary)" }} />
                )}
              </button>
            ))}
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

        {/* Color theme */}
        <div>
          <p className="text-label font-medium text-[--color-text-primary] mb-3">Color theme</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {COLOR_THEMES.map((theme) => (
              <button
                key={theme.id}
                onClick={() => setColorTheme(theme.id as ColorTheme)}
                className={`relative flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${activeCardClass(colorTheme === theme.id)}`}
              >
                <div className="flex gap-1 shrink-0">
                  <div className="w-5 h-5 rounded-full border border-white/30" style={{ backgroundColor: theme.primary }} />
                  <div className="w-5 h-5 rounded-full border border-white/30" style={{ backgroundColor: theme.secondary }} />
                </div>
                <span className="text-sm font-medium text-[--color-text-primary] truncate">{theme.label}</span>
                {colorTheme === theme.id && mounted && (
                  <span className="absolute top-2 right-2 w-2 h-2 rounded-full" style={{ backgroundColor: "var(--color-primary)" }} />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
