"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setSubTeamsAction } from "@/app/actions/sub-teams";
import { SUBTEAM_COLORS, SUBTEAM_OPTIONS } from "@/lib/schedule-helpers";
import { toast } from "@/components/ui/toast";

/** Toggle chips for someone's sub-teams — each tap saves */
export function SubTeamPicker({ userId, current }: { userId: string; current: string[] }) {
  const router = useRouter();
  const [picked, setPicked] = useState<string[]>(current);
  const [pending, start] = useTransition();

  function toggle(value: string) {
    const next = picked.includes(value) ? picked.filter((v) => v !== value) : [...picked, value];
    const before = picked;
    setPicked(next);
    start(async () => {
      const res = await setSubTeamsAction(userId, next);
      if (!res.success) { setPicked(before); toast.error(res.error); return; }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap gap-2" aria-busy={pending}>
      {SUBTEAM_OPTIONS.map((o) => {
        const on = picked.includes(o.value);
        const color = SUBTEAM_COLORS[o.value];
        return (
          <button key={o.value} type="button" onClick={() => toggle(o.value)} aria-pressed={on}
            className="rounded-full border px-3 py-1 text-sm font-medium transition-colors"
            style={on
              ? { backgroundColor: color, borderColor: color, color: "#fff" }
              : { borderColor: "var(--color-border)", color: "var(--color-text-secondary)" }}>
            {on && "✓ "}{o.label}
          </button>
        );
      })}
    </div>
  );
}
