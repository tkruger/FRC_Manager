"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createVendorAction } from "@/app/actions/vendor";
import { Dialog, DialogContent, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";

export function AddVendorDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(createVendorAction, null);

  useEffect(() => {
    if (state?.success) {
      setOpen(false);
      router.refresh();
    }
  }, [state, router]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">+ Add vendor</Button>
      </DialogTrigger>
      <DialogContent title="Add vendor">
        <form action={action} className="space-y-4">
          {state && !state.success && (
            <div className="text-sm text-[--color-danger] bg-[--color-danger]/10 rounded px-3 py-2">{state.error}</div>
          )}
          <Field label="Vendor name" name="name" required placeholder="e.g. AndyMark" />
          <Field label="Website" name="website" type="url" placeholder="https://" />
          <div className="grid grid-cols-2 gap-4">
            <Field label="Typical lead time (days)" name="typicalLeadDays" type="number" placeholder="5" />
            <Field label="Account number" name="accountNumber" placeholder="Optional" />
          </div>
          <Field label="FRC discount / PDV info" name="frcDiscount" placeholder="e.g. PDV accepted" />
          <Textarea label="Notes" name="notes" rows={2} placeholder="Rush orders available, free shipping over $50, etc." />
          <div className="flex items-center gap-2">
            <input type="checkbox" id="preferred" name="preferred" className="rounded" />
            <label htmlFor="preferred" className="text-sm text-[--color-text-primary]">Mark as preferred vendor</label>
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="submit" isLoading={pending}>Add vendor</Button>
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancel</Button>
            </DialogClose>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
