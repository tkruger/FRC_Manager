"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { snoozeCompetitionAlertsAction } from "@/app/actions/notification-settings";

const fmt = (iso: string) => new Date(iso).toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" });

/**
 * "Not at the event?" — snooze competition alerts instead of turning them off for good.
 * eventOn: a competition is happening now (offers "until it ends").
 */
export function SnoozeAlerts({ until: initial, eventOn }: { until: string | null; eventOn: boolean }) {
  const router = useRouter();
  const [until, setUntil] = useState(initial && new Date(initial) > new Date() ? initial : null);
  const [pending, start] = useTransition();

  const choose = (choice: "2h" | "morning" | "event" | "off") => start(async () => {
    const res = await snoozeCompetitionAlertsAction(choice);
    if (!res.success) { toast.error(res.error); return; }
    setUntil(res.until);
    toast.success(res.until ? `Competition alerts snoozed until ${fmt(res.until)}` : "Competition alerts are back on");
    router.refresh();
  });

  if (until) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-(--color-border) bg-(--color-surface-overlay) px-3 py-2 text-sm">
        <span className="flex items-center gap-2 text-(--color-text-primary)">
          <BellOff className="h-4 w-4 text-(--color-text-secondary)" aria-hidden />
          Competition alerts snoozed until <b>{fmt(until)}</b> — they still collect in your notifications.
        </span>
        <Button size="sm" variant="outline" isLoading={pending} onClick={() => choose("off")}>Turn back on</Button>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-(--color-border) px-3 py-2 text-sm">
      <span className="flex items-center gap-2 text-(--color-text-secondary)">
        <BellOff className="h-4 w-4" aria-hidden />
        Not at the event? Snooze alerts:
      </span>
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => choose("2h")}>2 hours</Button>
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => choose("morning")}>Until tomorrow morning</Button>
      {eventOn && <Button size="sm" variant="ghost" disabled={pending} onClick={() => choose("event")}>Until the event ends</Button>}
    </div>
  );
}
