"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { respondToShiftAction } from "@/app/actions/volunteers";

export interface ShiftAsk {
  meetingId: string;
  title: string;
  /** "Tue, Nov 4 · 3:00 PM – 8:00 PM" */
  when: string;
  askedBy: string | null;
  instructions: string | null;
  /** Days until the meeting (0 = today) */
  days: number;
}

/**
 * Home, top of the page: the soonest meeting someone has been asked to cover, with Confirm /
 * Can't make it right there, and a link to the details. Any other asks are counted below it.
 */
export function ShiftAskCard({ ask, more }: { ask: ShiftAsk; more: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<"yes" | "no" | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);

  const respond = (accept: boolean) => {
    setBusy(accept ? "yes" : "no");
    start(async () => {
      const res = await respondToShiftAction(ask.meetingId, accept);
      setBusy(null);
      if (!res.success) { toast.error(res.error ?? "Couldn't save."); return; }
      toast.success(accept ? "Confirmed — thank you!" : "Got it — you're off this one");
      router.refresh();
    });
  };
  const soon = ask.days === 0 ? "Today" : ask.days === 1 ? "Tomorrow" : `In ${ask.days} days`;

  return (
    <section className="card border-l-4 border-l-(--color-warning) space-y-3" aria-label="Volunteer request waiting on you">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-small font-semibold uppercase tracking-wide text-(--color-warning)">
            🙋 Waiting on you · {soon}
          </p>
          <h2 className="mt-1 text-h3 text-(--color-text-primary)">
            {ask.askedBy ? `${ask.askedBy} asked you to volunteer` : "You've been asked to volunteer"}
          </h2>
          <p className="text-sm text-(--color-text-secondary)"><span className="font-medium text-(--color-text-primary)">{ask.title}</span> · {ask.when}</p>
        </div>
        <Link href={`/volunteers?meeting=${ask.meetingId}`} className="shrink-0 text-sm font-medium text-(--color-secondary) hover:underline">
          Details →
        </Link>
      </div>

      {ask.instructions && (
        <div>
          <button type="button" onClick={() => setShowInstructions((v) => !v)} className="text-small font-medium text-(--color-secondary) hover:underline">
            {showInstructions ? "Hide shift instructions" : "Shift instructions"}
          </button>
          {showInstructions && (
            <p className="mt-1 whitespace-pre-wrap rounded-md bg-(--color-surface-overlay) px-3 py-2 text-sm text-(--color-text-primary)">{ask.instructions}</p>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" isLoading={busy === "yes" && pending} disabled={pending} onClick={() => respond(true)}>Confirm</Button>
        <Button size="sm" variant="outline" isLoading={busy === "no" && pending} disabled={pending} onClick={() => respond(false)}>Can&apos;t make it</Button>
        {more > 0 && (
          <Link href="/volunteers" className="ml-auto text-small text-(--color-text-secondary) hover:text-(--color-primary)">
            +{more} more request{more === 1 ? "" : "s"} →
          </Link>
        )}
      </div>
    </section>
  );
}
