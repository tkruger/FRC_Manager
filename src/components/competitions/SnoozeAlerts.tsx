"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { snoozeCompetitionAlertsAction } from "@/app/actions/notification-settings";

const fmt = (iso: string) => new Date(iso).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

type Choice = "2h" | "morning" | "days" | "event" | "off";

/**
 * "Not at the event?" — snooze competition alerts instead of turning them off for good.
 * eventOn: a competition is happening now (offers "until it ends").
 */
export function SnoozeAlerts({ until: initial, eventOn }: { until: string | null; eventOn: boolean }) {
  const router = useRouter();
  const [until, setUntil] = useState(initial && new Date(initial) > new Date() ? initial : null);
  const [days, setDays] = useState(3);
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<Choice | null>(null);

  const choose = (choice: Choice) => start(async () => {
    setBusy(choice);
    const res = await snoozeCompetitionAlertsAction(choice, days);
    setBusy(null);
    if (!res.success) { toast.error(res.error); return; }
    setUntil(res.until);
    toast.success(res.until ? `Competition alerts snoozed until ${fmt(res.until)}` : "Competition alerts are back on");
    router.refresh();
  });

  if (until) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-(--color-warning)/40 bg-(--color-warning)/10 px-4 py-3 text-sm">
        <span className="flex items-center gap-2 text-(--color-text-primary)">
          <BellOff className="h-4 w-4 shrink-0 text-(--color-warning)" aria-hidden />
          <span>Competition alerts snoozed until <b>{fmt(until)}</b> — they still collect in your notifications.</span>
        </span>
        <Button size="sm" isLoading={pending} onClick={() => choose("off")}>Turn back on</Button>
      </div>
    );
  }
  return (
    <div className="space-y-3 rounded-lg border border-(--color-border) bg-(--color-surface-overlay) px-4 py-3">
      <p className="flex items-center gap-2 text-sm font-medium text-(--color-text-primary)">
        <BellOff className="h-4 w-4 shrink-0 text-(--color-text-secondary)" aria-hidden />
        Not at the event? Snooze competition alerts
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" disabled={pending} isLoading={busy === "2h"} onClick={() => choose("2h")}>2 hours</Button>
        <Button size="sm" variant="outline" disabled={pending} isLoading={busy === "morning"} onClick={() => choose("morning")}>Until tomorrow morning</Button>
        {eventOn && <Button size="sm" variant="outline" disabled={pending} isLoading={busy === "event"} onClick={() => choose("event")}>Until the event ends</Button>}
        <span className="flex items-center gap-1.5">
          <select
            className="h-9 rounded-md border border-(--color-border) bg-(--color-surface) px-2 text-sm text-(--color-text-primary) focus:border-(--color-primary) focus:outline-none focus:ring-2 focus:ring-(--color-primary)/20"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            aria-label="Number of days to snooze"
            disabled={pending}
          >
            {[1, 2, 3, 4, 5, 6, 7, 10, 14, 21, 30].map((n) => <option key={n} value={n}>{n} day{n === 1 ? "" : "s"}</option>)}
          </select>
          <Button size="sm" variant="outline" disabled={pending} isLoading={busy === "days"} onClick={() => choose("days")}>Snooze</Button>
        </span>
      </div>
      <p className="text-small text-(--color-text-secondary)">No pushes or emails until then — they still show in your notifications. A snooze for days ends at 7 AM.</p>
    </div>
  );
}
