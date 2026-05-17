"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateVendorAction } from "@/app/actions/vendor";
import { Dialog, DialogContent, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";

interface Vendor {
  id: string;
  name: string;
  website: string | null;
  frcDiscount: string | null;
  typicalLeadDays: number | null;
  primaryContact: string | null;
  accountNumber: string | null;
  notes: string | null;
  preferred: boolean;
}

export function EditVendorDialog({ vendor }: { vendor: Vendor }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await updateVendorAction(vendor.id, fd);
      if (result.success) { setOpen(false); router.refresh(); }
      else setError(result.error ?? "Failed to update vendor.");
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="text-small text-[--color-secondary] hover:underline">
          Edit
        </button>
      </DialogTrigger>
      <DialogContent title={`Edit: ${vendor.name}`}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="text-sm text-[--color-danger] bg-[--color-danger]/10 rounded px-3 py-2">{error}</div>
          )}

          <Field label="Vendor name" name="name" required defaultValue={vendor.name} />
          <Field label="Website" name="website" type="url" placeholder="https://" defaultValue={vendor.website ?? ""} />
          <div className="grid grid-cols-2 gap-4">
            <Field label="Typical lead time (days)" name="typicalLeadDays" type="number"
              placeholder="5" defaultValue={vendor.typicalLeadDays ?? ""} />
            <Field label="Account number" name="accountNumber"
              placeholder="Optional" defaultValue={vendor.accountNumber ?? ""} />
          </div>
          <Field label="Primary contact" name="primaryContact"
            placeholder="Name or email" defaultValue={vendor.primaryContact ?? ""} />
          <Field label="FRC discount / PDV info" name="frcDiscount"
            placeholder="e.g. PDV accepted" defaultValue={vendor.frcDiscount ?? ""} />
          <Textarea label="Notes" name="notes" rows={2}
            placeholder="Rush orders available, free shipping over $50, etc."
            defaultValue={vendor.notes ?? ""} />
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" name="preferred" defaultChecked={vendor.preferred} className="rounded" />
            <span className="text-sm text-[--color-text-primary]">Mark as preferred vendor</span>
          </label>

          <div className="flex gap-2 pt-2">
            <Button type="submit" isLoading={isPending}>Save changes</Button>
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancel</Button>
            </DialogClose>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
