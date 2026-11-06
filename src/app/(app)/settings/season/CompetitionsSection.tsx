"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Dialog, DialogContent, DialogClose } from "@/components/ui/dialog";
import { addCompetitionAction, updateCompetitionAction, deleteCompetitionAction } from "@/app/actions/season";
import { COMPETITION_STAGES, STAGE_INFO, designation, type CompetitionStage } from "@/lib/competition";
import { toast } from "@/components/ui/toast";
import { LinkedDates } from "@/components/ui/linked-dates";

export interface Competition {
  id:          string;
  name:        string;
  location:    string | null;
  startDate:   string; // ISO
  endDate:     string; // ISO
  stage:       CompetitionStage;
  stageNumber: number | null;
  /** The Blue Alliance event code, e.g. 2026casnv */
  tbaEventKey: string | null;
}

/** One of the team's events on The Blue Alliance, to fill the dialog from */
export interface TbaEventOption {
  key: string; name: string; startDate: string; endDate: string; location: string;
  /** TBA event type: 0 regional, 1 district, 2/5 district championship, 3/4 Championship, 99 offseason, 100 preseason */
  eventType: number;
  /** TBA's week, counted from 0 for Week 1 */
  week: number | null;
}

/** Our stage and number for a TBA event */
function stageFor(e: TbaEventOption): { stage: CompetitionStage; number: string } {
  switch (e.eventType) {
    case 0: case 1: return { stage: "WEEK", number: e.week != null ? String(e.week + 1) : "" };
    case 2: case 5: return { stage: "PLAYOFF", number: "" };
    case 3: case 4: return { stage: "WORLDS", number: "" };
    case 100:       return { stage: "PRACTICE", number: "" };
    default:        return { stage: "OFFSEASON", number: "" };
  }
}

const STAGE_OPTIONS = COMPETITION_STAGES.map((s) => ({ value: s, label: STAGE_INFO[s].label }));

function day(iso: string) {
  // Competition dates are calendar days stored at UTC midnight
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export function CompetitionsSection({
  seasonId, competitions, canEdit, tbaEvents = null,
}: { seasonId: string; competitions: Competition[]; canEdit: boolean; tbaEvents?: TbaEventOption[] | null }) {
  const sorted = [...competitions].sort((a, b) => a.startDate.localeCompare(b.startDate));

  return (
    <div className="mt-5 pt-4 border-t border-(--color-border)">
      <div className="flex flex-col gap-3 mb-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-h3 text-(--color-text-primary)">Competitions</h3>
          <p className="text-small text-(--color-text-secondary)">
            Task templates can schedule work relative to these (e.g. 2 days before each Week competition).
          </p>
        </div>
        {canEdit && <CompetitionDialog seasonId={seasonId} existing={competitions} tbaEvents={tbaEvents} />}
      </div>

      {sorted.length === 0 ? (
        <p className="text-small text-(--color-text-secondary)">No competitions added yet.</p>
      ) : (
        <ul className="divide-y divide-(--color-border) rounded-md border border-(--color-border)">
          {sorted.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
              <div className="flex items-center gap-3 min-w-0">
                <span className="shrink-0 rounded px-1.5 py-0.5 font-mono text-xs font-semibold bg-(--color-secondary)/10 text-(--color-secondary)">
                  {designation(c.stage, c.stageNumber)}
                </span>
                <div className="min-w-0">
                  <Link href={`/competitions/${c.id}`} className="block text-sm font-medium text-(--color-text-primary) truncate hover:text-(--color-primary)">{c.name}</Link>
                  <p className="text-small text-(--color-text-secondary) truncate">
                    {day(c.startDate)}{c.endDate.slice(0, 10) !== c.startDate.slice(0, 10) && ` – ${day(c.endDate)}`}
                    {c.location && ` · ${c.location}`}
                    {c.tbaEventKey && <span className="font-mono"> · {c.tbaEventKey}</span>}
                  </p>
                </div>
              </div>
              {canEdit && (
                <div className="flex gap-1.5">
                  <CompetitionDialog seasonId={seasonId} existing={competitions} competition={c} tbaEvents={tbaEvents} />
                  <DeleteCompetition competition={c} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CompetitionDialog({
  seasonId, existing, competition, tbaEvents,
}: { seasonId: string; existing: Competition[]; competition?: Competition; tbaEvents: TbaEventOption[] | null }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen]   = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<CompetitionStage>(competition?.stage ?? "WEEK");
  const [pending, start]  = useTransition();

  // Suggest the next free number for the chosen stage. Not for Week competitions: their
  // number is the official FRC week (a team's second event may well be Week 5), and Week 0
  // is counted back from it — so it's left for the person to fill in.
  function nextNumber(s: CompetitionStage) {
    if (s === "WEEK") return "";
    const used = existing.filter((c) => c.stage === s && c.id !== competition?.id).map((c) => c.stageNumber ?? 0);
    return used.length ? Math.max(...used) + 1 : STAGE_INFO[s].firstNumber;
  }
  const [number, setNumber] = useState<string>(String(competition?.stageNumber ?? nextNumber(competition?.stage ?? "WEEK")));

  // Fill the form from one of the team's events on The Blue Alliance
  function pickTba(key: string) {
    const e = tbaEvents?.find((x) => x.key === key);
    const form = formRef.current;
    if (!e || !form) return;
    const set = (name: string, value: string) => {
      const el = form.elements.namedItem(name) as HTMLInputElement | null;
      if (el) el.value = value;
    };
    set("name", e.name); set("location", e.location); set("tbaEventKey", e.key);
    set("startDate", e.startDate); set("endDate", e.endDate);
    const { stage: s, number: n } = stageFor(e);
    setStage(s);
    setNumber(STAGE_INFO[s].numbered ? (n || String(nextNumber(s))) : "");
  }
  // Events already linked to another competition
  const taken = new Set(existing.filter((c) => c.id !== competition?.id).map((c) => c.tbaEventKey).filter(Boolean));
  const tbaChoices = (tbaEvents ?? []).filter((e) => !taken.has(e.key));

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const res = competition
        ? await updateCompetitionAction(seasonId, competition.id, fd)
        : await addCompetitionAction(seasonId, fd);
      if (!res.success) { setError(res.error ?? "Couldn't save."); return; }
      toast.success(competition ? "Competition saved" : "Competition added");
      setOpen(false);
      router.refresh();
    });
  }

  const info = STAGE_INFO[stage];
  const preview = designation(stage, info.numbered && number !== "" ? Number(number) : null);

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        {competition ? "Edit" : "+ Add competition"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title={competition ? `Edit ${designation(competition.stage, competition.stageNumber)}` : "Add competition"}>
          <form ref={formRef} onSubmit={submit} className="space-y-4">
            {error && <div className="text-sm text-(--color-danger) bg-(--color-danger)/10 rounded px-3 py-2">{error}</div>}

            {tbaChoices.length > 0 && (
              <Select
                label="Find on The Blue Alliance"
                options={[{ value: "", label: "Pick one of your team's events…" }, ...tbaChoices.map((e) => ({ value: e.key, label: `${e.name} (${day(e.startDate)})` }))]}
                defaultValue=""
                onChange={(e) => pickTba(e.target.value)}
                hint="Fills in the name, dates, location and event code"
              />
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                label="Type"
                name="stage"
                options={STAGE_OPTIONS}
                value={stage}
                onChange={(e) => {
                  const s = e.target.value as CompetitionStage;
                  setStage(s);
                  if (!competition || s !== competition.stage) setNumber(String(nextNumber(s)));
                }}
              />
              {info.numbered ? (
                <Field
                  label="Number"
                  name="stageNumber"
                  type="number"
                  min="0"
                  max="99"
                  required
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                  placeholder={stage === "WEEK" ? "e.g. 2" : undefined}
                  hint={number === "" ? "Designation: —" : `Designation: ${preview}`}
                />
              ) : (
                <div className="flex items-end pb-3 text-small text-(--color-text-secondary)">Designation: {preview}</div>
              )}
            </div>

            {stage === "WEEK" && (
              <p className="rounded-md bg-(--color-surface-overlay) px-3 py-2 text-small text-(--color-text-secondary)">
                Use the event&apos;s <b>official FRC week</b> as its number — a Week 2 event is <b>2</b> and a Week 5 event is <b>5</b>, even if
                they&apos;re your first two. Week 0 (the build deadline) is counted back from your lowest-numbered Week event, so
                numbering them 1, 2 instead would put everything due before Week 0 a week early. A Week 0 scrimmage is number <b>0</b>.
              </p>
            )}

            <Field label="Event name" name="name" required maxLength={120}
              defaultValue={competition?.name} placeholder="e.g. Hudson Valley Regional" />
            <Field label="Location" name="location" maxLength={160}
              defaultValue={competition?.location ?? ""} placeholder="Optional" />
            <div className="grid grid-cols-2 gap-4">
              <Field label="Start date" name="startDate" type="date" required defaultValue={competition?.startDate.slice(0, 10)}
                hint="The event's first day — template tasks count from it" />
              <Field label="End date" name="endDate" type="date" defaultValue={competition?.endDate.slice(0, 10)} hint="Blank = one day" />
              <LinkedDates start="startDate" end="endDate" />
            </div>
            <Field label="Event code" name="tbaEventKey" maxLength={200}
              defaultValue={competition?.tbaEventKey ?? ""} placeholder="e.g. 2026casnv — or paste a TBA, Nexus or FIRST link"
              hint="Links the competition to its live schedule, results and rankings" />

            <div className="flex gap-2 pt-1">
              <Button type="submit" isLoading={pending}>{competition ? "Save" : "Add competition"}</Button>
              <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function DeleteCompetition({ competition }: { competition: Competition }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      variant="danger"
      disabled={pending}
      onClick={() => {
        if (!confirm(`Delete ${designation(competition.stage, competition.stageNumber)} (${competition.name})? Tasks already created from templates are kept.`)) return;
        start(async () => {
          const res = await deleteCompetitionAction(competition.id);
          if (res.success) toast.success("Competition deleted"); else toast.error(res.error ?? "Couldn't delete.");
          router.refresh();
        });
      }}
    >
      Delete
    </Button>
  );
}
