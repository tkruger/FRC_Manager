"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { logExpenseAction } from "@/app/actions/budget";
import { Dialog, DialogContent, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";

interface Props {
  budgetId: string;
  categories: { id: string; label: string }[];
}

export function LogExpenseDialog({ budgetId, categories }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const catOptions = categories.map((c) => ({ value: c.id, label: c.label }));

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await logExpenseAction(budgetId, fd);
      if (result.success) { setOpen(false); router.refresh(); }
      else setError(result.error ?? "Failed.");
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">+ Log expense</Button>
      </DialogTrigger>
      <DialogContent title="Log expense">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="text-sm text-[--color-danger] bg-[--color-danger]/10 rounded px-3 py-2">{error}</div>}
          <Field label="Description" name="description" required placeholder="e.g. Falcon 500 motors x4" />
          <div className="grid grid-cols-2 gap-4">
            <Field label="Amount ($)" name="amount" type="number" required step="0.01" placeholder="0.00" />
            <Field label="Date" name="date" type="date" required defaultValue={new Date().toISOString().split("T")[0]} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Vendor" name="vendor" placeholder="e.g. AndyMark" />
            <Field label="Payment method" name="paymentMethod" placeholder="e.g. Team credit card" />
          </div>
          <Select label="Budget category" name="categoryId" placeholder="Select category" options={catOptions} />
          <div className="flex gap-2 pt-2">
            <Button type="submit" isLoading={isPending}>Log expense</Button>
            <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
