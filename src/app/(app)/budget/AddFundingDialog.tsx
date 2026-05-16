"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addFundingSourceAction } from "@/app/actions/budget";
import { Dialog, DialogContent, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const TYPE_OPTIONS = [
  { value: "SCHOOL_ALLOCATION", label: "School Allocation" },
  { value: "CORPORATE_SPONSOR", label: "Corporate Sponsor" },
  { value: "GRANT", label: "Grant" },
  { value: "FUNDRAISER", label: "Fundraiser" },
  { value: "INDIVIDUAL_DONATION", label: "Individual Donation" },
  { value: "PDV", label: "Product Donation Voucher" },
  { value: "OTHER", label: "Other" },
];

const STATUS_OPTIONS = [
  { value: "PLEDGED", label: "Pledged" },
  { value: "RECEIVED", label: "Received" },
  { value: "PARTIAL", label: "Partially received" },
];

export function AddFundingDialog({ budgetId }: { budgetId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await addFundingSourceAction(budgetId, fd);
      if (result.success) { setOpen(false); router.refresh(); }
      else setError(result.error ?? "Failed.");
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">+ Add funding</Button>
      </DialogTrigger>
      <DialogContent title="Add funding source">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="text-sm text-[--color-danger] bg-[--color-danger]/10 rounded px-3 py-2">{error}</div>}
          <Field label="Source name" name="name" required placeholder="e.g. ACME Corp Sponsorship" />
          <div className="grid grid-cols-2 gap-4">
            <Select label="Type" name="type" required options={TYPE_OPTIONS} />
            <Select label="Status" name="status" options={STATUS_OPTIONS} defaultValue="PLEDGED" />
          </div>
          <Field label="Amount ($)" name="amount" type="number" required step="0.01" placeholder="0.00" />
          <Textarea label="Notes" name="notes" rows={2} placeholder="Restrictions, expiry, conditions..." />
          <div className="flex gap-2 pt-2">
            <Button type="submit" isLoading={isPending}>Add source</Button>
            <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
