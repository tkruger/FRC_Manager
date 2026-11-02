"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { MarkdownEditor } from "@/components/markdown/MarkdownEditor";
import { toast } from "@/components/ui/toast";
import { saveVolunteerSettingsAction } from "@/app/actions/volunteers";

/** Coordinators: the default instructions and adults per meeting */
export function VolunteerSettingsForm({ minAdults, instructions }: { minAdults: number; instructions: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <section className="card space-y-4">
      <div>
        <h2 className="text-h3 text-(--color-text-primary)">Coverage and shift instructions</h2>
        <p className="text-small text-(--color-text-secondary)">The instructions go out with every sign-up and the day-before reminder, unless a meeting has its own.</p>
      </div>
      {error && <p className="text-sm text-(--color-danger)">{error}</p>}
      <form className="space-y-4" onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setError(null);
        start(async () => {
          const res = await saveVolunteerSettingsAction({ instructions: String(fd.get("instructions") ?? ""), minAdults: Number(fd.get("minAdults")) });
          if (!res.success) { setError(res.error); return; }
          toast.success("Volunteer settings saved");
          router.refresh();
        });
      }}>
        <label className="flex flex-wrap items-center gap-3 text-sm font-medium text-(--color-text-primary)">
          Confirmed adults each meeting needs
          <input name="minAdults" type="number" min={1} max={20} defaultValue={minAdults} required
            className="h-9 w-20 rounded-md border border-(--color-border) bg-(--color-surface) px-2 text-sm text-(--color-text-primary)" />
        </label>
        <MarkdownEditor name="instructions" label="Default shift instructions" defaultValue={instructions ?? ""} rows={6} maxLength={5000}
          hint="Where to go and when to arrive, who to check in with, what to do, parking, who to call if something comes up." />
        <Button type="submit" isLoading={pending}>Save settings</Button>
      </form>
    </section>
  );
}

