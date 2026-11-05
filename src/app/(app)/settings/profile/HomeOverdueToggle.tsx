"use client";

import { useState, useTransition } from "react";
import { toast } from "@/components/ui/toast";
import { setHomeTeamOverdueAction } from "@/app/actions/profile";

/** Home's Overdue tasks tile: your own tasks (the default) or everyone's */
export function HomeOverdueToggle({ on, parent }: { on: boolean; parent: boolean }) {
  const [checked, setChecked] = useState(on);
  const [pending, start] = useTransition();
  return (
    <section className="card space-y-2">
      <h2 className="text-h3 text-(--color-text-primary)">Home screen</h2>
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          className="mt-1 rounded"
          checked={checked}
          disabled={pending}
          onChange={(e) => {
            const next = e.target.checked;
            setChecked(next);
            start(async () => {
              const res = await setHomeTeamOverdueAction(next);
              if (!res.success) { setChecked(!next); toast.error(res.error); }
            });
          }}
        />
        <span>
          <span className="block text-sm font-medium text-(--color-text-primary)">Show the whole team&apos;s overdue tasks</span>
          <span className="block text-small text-(--color-text-secondary)">
            Off: the Overdue tasks tile on Home counts only tasks assigned to you{parent ? " (or to your students)" : ""}.
          </span>
        </span>
      </label>
    </section>
  );
}
