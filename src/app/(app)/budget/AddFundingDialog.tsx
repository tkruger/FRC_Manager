"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addFundingSourceAction, updateFundingSourceAction, deleteFundingSourceAction } from "@/app/actions/budget";
import { Dialog, DialogContent, DialogTrigger, DialogClose, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FUNDING_TYPE_LABELS } from "@/lib/funding";

const TYPE_OPTIONS = Object.entries(FUNDING_TYPE_LABELS).map(([value, label]) => ({ value, label }));

const STATUS_OPTIONS = [
  { value: "PLEDGED",  label: "Pledged (not in yet)" },
  { value: "RECEIVED", label: "Received" },
  { value: "PARTIAL",  label: "Partly received" },
];

export interface FundingSourceData {
  id: string;
  name: string;
  type: string;
  amount: number;
  status: string;
  receivedAmount: number | null;
  receivedDate: string | null;
  notes: string | null;
}

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Add a funding source, or (with `source`) edit one — e.g. mark a pledge received. The
 * team's own contribution is the "Team account" type. Received money is dated so it shows
 * on the budget chart when it came in.
 */
export function AddFundingDialog({ budgetId, source }: { budgetId: string; source?: FundingSourceData }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [type, setType] = useState(source?.type ?? "");
  const [status, setStatus] = useState(source?.status ?? "PLEDGED");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = source ? await updateFundingSourceAction(source.id, fd) : await addFundingSourceAction(budgetId, fd);
      if (result.success) { setOpen(false); router.refresh(); }
      else setError(result.error ?? "Couldn't save it.");
    });
  }

  function handleDelete() {
    if (!source || !confirm(`Remove “${source.name}” from the budget?`)) return;
    startTransition(async () => {
      const result = await deleteFundingSourceAction(source.id);
      if (result.success) { setOpen(false); router.refresh(); }
      else setError(result.error ?? "Couldn't remove it.");
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) { setType(source?.type ?? ""); setStatus(source?.status ?? "PLEDGED"); setError(null); } }}>
      <DialogTrigger asChild>
        {source
          ? <Button variant="outline" size="sm">Edit</Button>
          : <Button variant="outline" size="sm">+ Add funding</Button>}
      </DialogTrigger>
      <DialogContent title={source ? `Edit: ${source.name}` : "Add funding"}
        description={source ? undefined : "Money raised toward the budget goal. Use “Team account” for what the team puts in from its own account."}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="text-sm text-(--color-danger) bg-(--color-danger)/10 rounded px-3 py-2">{error}</div>}
          <Field label="Source name" name="name" required defaultValue={source?.name ?? (type === "TEAM_ACCOUNT" ? "Team account" : "")}
            key={type === "TEAM_ACCOUNT" && !source ? "team" : "name"} placeholder="e.g. ACME Corp sponsorship" />
          <div className="grid grid-cols-2 gap-4">
            <Select label="Type" name="type" required options={TYPE_OPTIONS} value={type}
              onChange={(e) => { setType(e.target.value); if (!source && e.target.value === "TEAM_ACCOUNT") setStatus("RECEIVED"); }} placeholder="Choose…" />
            <Select label="Status" name="status" options={STATUS_OPTIONS} value={status} onChange={(e) => setStatus(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label={status === "PARTIAL" ? "Total pledged ($)" : "Amount ($)"} name="amount" type="number" required min="0" step="0.01" placeholder="0.00"
              defaultValue={source?.amount ?? ""} />
            {status === "PARTIAL" && (
              <Field label="Received so far ($)" name="receivedAmount" type="number" required min="0" step="0.01" placeholder="0.00"
                defaultValue={source?.receivedAmount ?? ""} />
            )}
          </div>
          {status !== "PLEDGED" && (
            <Field label={status === "PARTIAL" ? "Last received on" : "Received on"} name="receivedDate" type="date"
              defaultValue={source?.receivedDate?.slice(0, 10) ?? today()} hint="Places it on the budget chart." />
          )}
          <Textarea label="Notes" name="notes" rows={2} placeholder="Restrictions, expiry, conditions…" defaultValue={source?.notes ?? ""} />
          <DialogFooter>
            <Button type="submit" isLoading={isPending}>{source ? "Save" : "Add funding"}</Button>
            <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
            {source && <Button type="button" variant="ghost" className="ml-auto text-(--color-danger)" onClick={handleDelete}>Remove</Button>}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
