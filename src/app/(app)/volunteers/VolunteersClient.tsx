"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogClose, DialogFooter } from "@/components/ui/dialog";
import { Markdown } from "@/components/markdown/Markdown";
import { MarkdownEditor } from "@/components/markdown/MarkdownEditor";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { coverage, VOLUNTEER_STATUS_INFO, type VolunteerStatus } from "@/lib/volunteers";
import {
  assignVolunteerAction, removeVolunteerAction, respondToShiftAction, saveVolunteerSettingsAction,
  setMeetingInstructionsAction, signUpForShiftAction, withdrawFromShiftAction,
} from "@/app/actions/volunteers";

export interface MeetingRow {
  id: string;
  when: string;
  title: string | null;
  /** This meeting's own instructions (null: the team's default) */
  instructions: string | null;
  volunteers: { userId: string; name: string; status: VolunteerStatus; phone: string | null }[];
}

export interface AdultRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  cleared: boolean;
  until: string | null;
  daysLeft: number | null;
  /** Was cleared, but it ran out */
  lapsed: boolean;
  upcoming: number;
}

interface Props {
  me: { id: string; cleared: boolean; adult: boolean; clearedUntil: string | null; hasPhone: boolean };
  coordinating: boolean;
  isHeadMentor: boolean;
  minAdults: number;
  defaultInstructions: string | null;
  meetings: MeetingRow[];
  adults: AdultRow[];
  focusId: string | null;
}

type Result = { success: true } | { success: false; error: string };

const fmtDay = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

export function VolunteersClient({ me, coordinating, isHeadMentor, minAdults, defaultInstructions, meetings, adults, focusId }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [shortOnly, setShortOnly] = useState(false);
  const [editing, setEditing] = useState<MeetingRow | null>(null);

  function run(key: string, fn: () => Promise<Result>, done: string) {
    setBusy(key);
    start(async () => {
      const res = await fn();
      setBusy(null);
      if (!res.success) { toast.error(res.error); return; }
      toast.success(done);
      router.refresh();
    });
  }

  // A linked meeting (from a reminder or notification): scroll to it
  useEffect(() => {
    if (focusId) document.getElementById(`meeting-${focusId}`)?.scrollIntoView({ block: "center" });
  }, [focusId]);

  const mine = meetings
    .map((m) => ({ m, v: m.volunteers.find((v) => v.userId === me.id) }))
    .filter((x) => x.v && x.v.status !== "DECLINED");
  const shown = shortOnly ? meetings.filter((m) => !coverage(m.volunteers, minAdults).covered) : meetings;
  const shortCount = meetings.filter((m) => !coverage(m.volunteers, minAdults).covered).length;
  const clearedAdults = useMemo(() => adults.filter((a) => a.cleared), [adults]);

  return (
    <div className="space-y-6">
      {/* Where you stand */}
      {!me.cleared && (me.adult || coordinating) && (
        <div className="card text-sm text-(--color-text-primary)">
          {coordinating && !me.adult
            ? "You coordinate volunteers. To sign up for shifts yourself, a Head Mentor needs to clear you to volunteer."
            : <>A Head Mentor needs to <b>clear you to volunteer</b> (usually after the school&apos;s background check) before you can sign up for shifts.</>}
        </div>
      )}
      {me.cleared && !me.hasPhone && (
        <p className="text-small text-(--color-text-secondary)">
          Tip: add your phone number in <Link href="/settings/profile" className="text-(--color-primary) hover:underline">Profile</Link> so the volunteer coordinator can reach you on the day.
        </p>
      )}

      {/* Your shifts */}
      {me.cleared && (
        <section className="space-y-3">
          <h2 className="text-h2 text-(--color-text-primary)">Your shifts</h2>
          {mine.length === 0 ? (
            <p className="text-body text-(--color-text-secondary)">You&apos;re not signed up for anything yet — pick a meeting below.</p>
          ) : (
            <ul className="card p-0 divide-y divide-(--color-border)">
              {mine.map(({ m, v }) => (
                <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-(--color-text-primary)">{m.title || "Team meeting"}</p>
                    <p className="text-small text-(--color-text-secondary)">{m.when}</p>
                  </div>
                  {v!.status === "PENDING" ? (
                    <span className="flex flex-wrap items-center gap-2">
                      <Badge variant="warning">Asked to cover</Badge>
                      <Button size="sm" isLoading={busy === `yes-${m.id}` && pending} onClick={() => run(`yes-${m.id}`, () => respondToShiftAction(m.id, true), "Confirmed — thank you!")}>Confirm</Button>
                      <Button size="sm" variant="outline" disabled={pending} onClick={() => run(`no-${m.id}`, () => respondToShiftAction(m.id, false), "Got it — you're off this one")}>Can&apos;t make it</Button>
                    </span>
                  ) : (
                    <span className="flex flex-wrap items-center gap-2">
                      <Badge variant="success">Confirmed</Badge>
                      <Button size="sm" variant="ghost" disabled={pending}
                        onClick={() => { if (confirm("Take yourself off this shift? The coordinator will be told if the meeting is short.")) run(`out-${m.id}`, () => withdrawFromShiftAction(m.id), "You're off this shift"); }}>
                        Can&apos;t make it
                      </Button>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* The team's standing instructions */}
      {(me.cleared || coordinating) && (
        <section className="card space-y-2">
          <h2 className="text-h3 text-(--color-text-primary)">Shift instructions</h2>
          {defaultInstructions
            ? <Markdown className="text-sm">{defaultInstructions}</Markdown>
            : <p className="text-small text-(--color-text-secondary)">{coordinating ? "No instructions yet — add where to go and what to do under Volunteer settings below." : "The volunteer coordinator hasn't added instructions yet."}</p>}
          <p className="text-xs text-(--color-text-secondary)">Some meetings have their own instructions; they&apos;re shown on the meeting and sent with its reminder.</p>
        </section>
      )}

      {/* Meetings */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-h2 text-(--color-text-primary)">
            Upcoming meetings
            {shortCount > 0 && <span className="ml-2 align-middle"><Badge variant="danger">{shortCount} need{shortCount === 1 ? "s" : ""} adults</Badge></span>}
          </h2>
          <label className="flex items-center gap-2 text-sm text-(--color-text-secondary) cursor-pointer">
            <input type="checkbox" className="accent-(--color-primary)" checked={shortOnly} onChange={(e) => setShortOnly(e.target.checked)} />
            Only meetings that need adults
          </label>
        </div>

        {shown.length === 0 ? (
          <div className="card text-center py-8 text-body text-(--color-text-secondary)">
            {meetings.length === 0 ? "No meetings scheduled in the next few weeks." : "Every meeting has enough adults. 🎉"}
          </div>
        ) : (
          <ul className="space-y-3">
            {shown.map((m) => {
              const c = coverage(m.volunteers, minAdults);
              const myRow = m.volunteers.find((v) => v.userId === me.id);
              const canSignUp = me.cleared && (!myRow || myRow.status === "DECLINED");
              const listed = m.volunteers.filter((v) => v.status !== "DECLINED" || coordinating);
              const assignable = clearedAdults.filter((a) => !m.volunteers.some((v) => v.userId === a.id && v.status !== "DECLINED"));
              return (
                <li key={m.id} id={`meeting-${m.id}`}
                  className={cn("card space-y-3 scroll-mt-24", !c.covered && "border-l-4 border-l-(--color-danger)", focusId === m.id && "ring-2 ring-(--color-primary)/50")}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-(--color-text-primary)">{m.title || "Team meeting"}</p>
                      <p className="text-small text-(--color-text-secondary)">{m.when}</p>
                    </div>
                    <span className="flex flex-wrap items-center gap-2">
                      <Badge variant={c.covered ? "success" : "danger"}>{c.confirmed} / {minAdults} adults</Badge>
                      {c.pending > 0 && <Badge variant="warning">{c.pending} waiting</Badge>}
                      {canSignUp && (
                        <Button size="sm" isLoading={busy === `up-${m.id}` && pending} onClick={() => run(`up-${m.id}`, () => signUpForShiftAction(m.id), "You're signed up — thank you!")}>
                          Sign up
                        </Button>
                      )}
                    </span>
                  </div>

                  {listed.length > 0 && (
                    <ul className="flex flex-wrap gap-2">
                      {listed.map((v) => (
                        <li key={v.userId} className={cn(
                          "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-small",
                          v.status === "CONFIRMED" ? "border-(--color-success)/40 bg-(--color-success)/10 text-(--color-text-primary)"
                            : v.status === "PENDING" ? "border-(--color-warning)/40 bg-(--color-warning)/10 text-(--color-text-primary)"
                            : "border-(--color-border) text-(--color-text-secondary) line-through",
                        )} title={VOLUNTEER_STATUS_INFO[v.status].label}>
                          {v.name}{v.userId === me.id && " (you)"}
                          {v.status === "PENDING" && <span className="text-(--color-text-secondary)">· asked</span>}
                          {coordinating && v.phone && v.status !== "DECLINED" && <a href={`tel:${v.phone}`} className="text-(--color-secondary) hover:underline">· {v.phone}</a>}
                          {coordinating && (
                            <button type="button" aria-label={`Take ${v.name} off this shift`} disabled={pending}
                              className="ml-0.5 text-(--color-text-secondary) hover:text-(--color-danger)"
                              onClick={() => { if (confirm(`Take ${v.name} off this shift?`)) run(`rm-${m.id}-${v.userId}`, () => removeVolunteerAction(m.id, v.userId), `${v.name} is off this shift`); }}>
                              ×
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}

                  {m.instructions && (
                    <details className="rounded-md bg-(--color-surface-overlay) px-3 py-2">
                      <summary className="cursor-pointer text-small font-medium text-(--color-text-primary)">Special instructions for this meeting</summary>
                      <Markdown className="text-sm mt-2">{m.instructions}</Markdown>
                    </details>
                  )}

                  {coordinating && (
                    <div className="flex flex-wrap items-center gap-2 border-t border-(--color-border) pt-3">
                      <select
                        aria-label="Ask someone to cover this meeting"
                        className="h-9 rounded-md border border-(--color-border) bg-(--color-surface) px-2 text-sm text-(--color-text-primary)"
                        value=""
                        disabled={pending || assignable.length === 0}
                        onChange={(e) => {
                          const a = clearedAdults.find((x) => x.id === e.target.value);
                          if (a) run(`as-${m.id}`, () => assignVolunteerAction(m.id, a.id), a.id === me.id ? "You're on this shift" : `Asked ${a.name} — they'll confirm or decline`);
                        }}>
                        <option value="">{assignable.length ? "Ask someone to cover…" : clearedAdults.length ? "Everyone cleared is on it" : "No one is cleared yet"}</option>
                        {assignable.map((a) => <option key={a.id} value={a.id}>{a.name}{a.upcoming ? ` (${a.upcoming} upcoming)` : ""}</option>)}
                      </select>
                      <Button size="sm" variant="outline" onClick={() => setEditing(m)}>
                        {m.instructions ? "Edit special instructions" : "Special instructions"}
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {coordinating && <SettingsCard minAdults={minAdults} instructions={defaultInstructions} />}
      {coordinating && <Roster adults={adults} isHeadMentor={isHeadMentor} />}

      {editing && <InstructionsDialog meeting={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

/** Coordinators: the default instructions and adults per meeting */
function SettingsCard({ minAdults, instructions }: { minAdults: number; instructions: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <section className="card space-y-4">
      <div>
        <h2 className="text-h3 text-(--color-text-primary)">Volunteer settings</h2>
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

/** Coordinators: one meeting's own instructions (a special event) */
function InstructionsDialog({ meeting, onClose }: { meeting: MeetingRow; onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  function save(text: string | null, done: string) {
    setError(null);
    start(async () => {
      const res = await setMeetingInstructionsAction(meeting.id, text);
      if (!res.success) { setError(res.error); return; }
      toast.success(done);
      onClose();
      router.refresh();
    });
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title="Special instructions" description={`${meeting.title || "Team meeting"} — ${meeting.when}. Used instead of the default instructions for this meeting.`}>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save(String(new FormData(e.currentTarget).get("instructions") ?? ""), "Instructions saved"); }}>
          {error && <p className="text-sm text-(--color-danger)">{error}</p>}
          <MarkdownEditor name="instructions" label="Instructions for this meeting" defaultValue={meeting.instructions ?? ""} rows={6} maxLength={5000} />
          <DialogFooter>
            <Button type="submit" isLoading={pending}>Save</Button>
            {meeting.instructions && <Button type="button" variant="outline" disabled={pending} onClick={() => save(null, "Back to the default instructions")}>Use the default</Button>}
            <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Coordinators: who can volunteer, how to reach them, and clearances running out */
function Roster({ adults, isHeadMentor }: { adults: AdultRow[]; isHeadMentor: boolean }) {
  const cleared = adults.filter((a) => a.cleared);
  const notYet = adults.filter((a) => !a.cleared);
  return (
    <section className="card space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-h3 text-(--color-text-primary)">Adults cleared to volunteer ({cleared.length})</h2>
          <p className="text-small text-(--color-text-secondary)">Head Mentors clear adults on the {isHeadMentor ? <Link href="/settings/members" className="text-(--color-primary) hover:underline">Team members</Link> : "Team members"} page.</p>
        </div>
      </div>
      {cleared.length === 0 ? (
        <p className="text-body text-(--color-text-secondary)">No one is cleared yet.</p>
      ) : (
        <ul className="divide-y divide-(--color-border)">
          {cleared.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-medium text-(--color-text-primary)">{a.name}</p>
                <p className="text-small text-(--color-text-secondary) break-all">
                  {[a.phone && <a key="p" href={`tel:${a.phone}`} className="hover:underline">{a.phone}</a>, a.email && <a key="e" href={`mailto:${a.email}`} className="hover:underline">{a.email}</a>]
                    .filter(Boolean).reduce<React.ReactNode[]>((acc, x, i) => (i ? [...acc, " · ", x] : [x]), [])}
                </p>
              </div>
              <span className="flex flex-wrap items-center gap-2">
                <Badge variant="neutral">{a.upcoming} upcoming</Badge>
                {a.until && (a.daysLeft !== null && a.daysLeft <= 30
                  ? <Badge variant="warning">Clearance ends {fmtDay(a.until)}</Badge>
                  : <span className="text-small text-(--color-text-secondary)">until {fmtDay(a.until)}</span>)}
              </span>
            </li>
          ))}
        </ul>
      )}
      {notYet.length > 0 && (
        <div className="space-y-1">
          <p className="text-sm font-medium text-(--color-text-primary)">Not cleared yet</p>
          <p className="text-small text-(--color-text-secondary)">
            {notYet.map((a) => `${a.name}${a.lapsed ? " (clearance ended)" : ""}`).join(", ")}
          </p>
        </div>
      )}
    </section>
  );
}
