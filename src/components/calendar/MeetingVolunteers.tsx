"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { coverage, type VolunteerStatus } from "@/lib/volunteers";
import { signUpForShiftAction } from "@/app/actions/volunteers";

export interface VolunteerView {
  myId: string;
  cleared: boolean;
  coordinating: boolean;
  minAdults: number;
}

/** A meeting's volunteers, in the meeting card: who's covering, and a quick sign-up */
export function MeetingVolunteers({ meetingId, volunteers, upcoming, view }: {
  meetingId: string;
  volunteers: { userId: string; name: string; status: VolunteerStatus }[];
  /** Hasn't happened yet (and isn't canceled) */
  upcoming: boolean;
  view: VolunteerView;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const c = coverage(volunteers, view.minAdults);
  const mine = volunteers.find((v) => v.userId === view.myId);
  const on = volunteers.filter((v) => v.status !== "DECLINED");

  return (
    <div className="rounded-md border border-(--color-border) px-3 py-2.5 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-label text-(--color-text-secondary)">Adult volunteers</p>
        <Badge variant={c.covered ? "success" : upcoming ? "danger" : "neutral"}>{c.confirmed} / {view.minAdults} confirmed</Badge>
      </div>
      {on.length > 0
        ? <p className="text-sm text-(--color-text-primary)">{on.map((v) => `${v.name}${v.status === "PENDING" ? " (asked)" : ""}`).join(", ")}</p>
        : <p className="text-small text-(--color-text-secondary)">No one yet.</p>}
      {upcoming && (
        <div className="flex flex-wrap items-center gap-3">
          {view.cleared && (!mine || mine.status === "DECLINED") && (
            <Button size="sm" isLoading={pending} onClick={() => start(async () => {
              const res = await signUpForShiftAction(meetingId);
              if (!res.success) { toast.error(res.error); return; }
              toast.success("You're signed up — thank you!");
              router.refresh();
            })}>Sign up to volunteer</Button>
          )}
          <Link href={`/volunteers?meeting=${meetingId}`} className="text-small font-medium text-(--color-secondary) hover:underline">
            {view.coordinating ? "Manage volunteers →" : "Volunteers →"}
          </Link>
        </div>
      )}
    </div>
  );
}
