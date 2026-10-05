"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Dialog, DialogContent, DialogClose } from "@/components/ui/dialog";
import { addCompetitionAction, updateCompetitionAction, deleteCompetitionAction } from "@/app/actions/season";
import { COMPETITION_STAGES, STAGE_INFO, designation, type CompetitionStage } from "@/lib/competition";
import { toast } from "@/components/ui/toast";

export interface Competition {
  id:          string;
  name:        string;
  location:    string | null;
  startDate:   string; // ISO
  endDate:     string; // ISO
  stage:       CompetitionStage;
  stageNumber: number | null;
}

const STAGE_OPTIONS = COMPETITION_STAGES.map((s) => ({ value: s, label: STAGE_INFO[s].label }));

function day(iso: string) {
  // Competition dates are calendar days stored at UTC midnight
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export function CompetitionsSection({
  seasonId, competitions, canEdit,
}: { seasonId: string; competitions: Competition[]; canEdit: boolean }) {
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
        {canEdit && <CompetitionDialog seasonId={seasonId} existing={competitions} />}
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
                  <p className="text-sm font-medium text-(--color-text-primary) truncate">{c.name}</p>
                  <p className="text-small text-(--color-text-secondary) truncate">
                    {day(c.startDate)}{c.endDate.slice(0, 10) !== c.startDate.slice(0, 10) && ` – ${day(c.endDate)}`}
                    {c.location && ` · ${c.location}`}
                  </p>
                </div>
              </div>
              {canEdit && (
                <div className="flex gap-1.5">
                  <CompetitionDialog seasonId={seasonId} existing={competitions} competition={c} />
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
  seasonId, existing, competition,
}: { seasonId: string; existing: Competition[]; competition?: Competition }) {
  const router = useRouter();
  const [open, setOpen]   = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<CompetitionStage>(competition?.stage ?? "WEEK");
  const [pending, start]  = useTransition();

  // Suggest the next free number for the chosen stage
  function nextNumber(s: CompetitionStage) {
    const used = existing.filter((c) => c.stage === s && c.id !== competition?.id).map((c) => c.stageNumber ?? 0);
    return used.length ? Math.max(...used) + 1 : STAGE_INFO[s].firstNumber;
  }
  const [number, setNumber] = useState<string>(String(competition?.stageNumber ?? nextNumber(competition?.stage ?? "WEEK")));

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
          <form onSubmit={submit} className="space-y-4">
            {error && <div className="text-sm text-(--color-danger) bg-(--color-danger)/10 rounded px-3 py-2">{error}</div>}

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
                  hint={`Designation: ${preview}`}
                />
              ) : (
                <div className="flex items-end pb-3 text-small text-(--color-text-secondary)">Designation: {preview}</div>
              )}
            </div>

            <Field label="Event name" name="name" required maxLength={120}
              defaultValue={competition?.name} placeholder="e.g. Hudson Valley Regional" />
            <Field label="Location" name="location" maxLength={160}
              defaultValue={competition?.location ?? ""} placeholder="Optional" />
            <div className="grid grid-cols-2 gap-4">
              <Field label="Start date" name="startDate" type="date" required defaultValue={competition?.startDate.slice(0, 10)} />
              <Field label="End date" name="endDate" type="date" defaultValue={competition?.endDate.slice(0, 10)} hint="Blank = one day" />
            </div>

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
      variant="ghost"
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
