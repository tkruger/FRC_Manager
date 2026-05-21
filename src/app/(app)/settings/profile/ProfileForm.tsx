"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { updateProfileAction } from "@/app/actions/profile";
import { useTheme, COLOR_THEMES } from "@/components/providers/ThemeProvider";
import type { ColorTheme } from "@/components/providers/ThemeProvider";

interface Props {
  initialName: string;
  initialEmail: string;
}

export function ProfileForm({ initialName, initialEmail }: Props) {
  const { colorTheme, setColorTheme, mode, setMode, resolvedTheme } = useTheme();
  const [state, action, isPending] = useActionState(updateProfileAction, null);

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
          <Field label="Display name" name="name" required defaultValue={initialName} />
          <Field label="Email address" name="email" type="email" required defaultValue={initialEmail} />
          <Button type="submit" isLoading={isPending}>Save changes</Button>
        </form>
      </div>

      {/* Appearance */}
      <div className="card space-y-5">
        <h2 className="text-h3 text-[--color-text-primary]">Appearance</h2>

        {/* Dark / light mode */}
        <div>
          <p className="text-label font-medium text-[--color-text-primary] mb-3">Display mode</p>
          <div className="flex flex-wrap gap-2">
            {(
              [
                { value: "LIGHT",       label: "Light"  },
                { value: "DARK",        label: "Dark"   },
                { value: "AUTO_SYSTEM", label: "System" },
                { value: "AUTO_TIME",   label: "Auto (time of day)" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.value}
                onClick={() => setMode(opt.value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                  mode === opt.value
                    ? "border-[--color-primary] bg-[--color-primary]/10 text-[--color-primary]"
                    : "border-[--color-border] text-[--color-text-secondary] hover:border-[--color-border-strong] hover:text-[--color-text-primary]"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Color theme */}
        <div>
          <p className="text-label font-medium text-[--color-text-primary] mb-3">Color theme</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {COLOR_THEMES.map((theme) => {
              const active = colorTheme === theme.id;
              return (
                <button
                  key={theme.id}
                  onClick={() => setColorTheme(theme.id as ColorTheme)}
                  className={`relative flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                    active
                      ? "border-[--color-primary] bg-[--color-surface-overlay] shadow-sm"
                      : "border-[--color-border] hover:border-[--color-border-strong]"
                  }`}
                >
                  {/* Color swatches */}
                  <div className="flex gap-1 shrink-0">
                    <div
                      className="w-5 h-5 rounded-full border border-white/30"
                      style={{ backgroundColor: theme.primary }}
                    />
                    <div
                      className="w-5 h-5 rounded-full border border-white/30"
                      style={{ backgroundColor: theme.secondary }}
                    />
                  </div>
                  <span className="text-sm font-medium text-[--color-text-primary] truncate">
                    {theme.label}
                  </span>
                  {active && (
                    <span className="absolute top-2 right-2 w-2 h-2 rounded-full" style={{ backgroundColor: "var(--color-primary)" }} />
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
