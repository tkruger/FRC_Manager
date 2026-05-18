"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { checkinToolAction } from "@/app/actions/tools";
import { Dialog, DialogContent, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

const CONDITION_OPTIONS = [
  { value: "EXCELLENT",    label: "Excellent — like new" },
  { value: "GOOD",         label: "Good — minor wear" },
  { value: "FAIR",         label: "Fair — noticeable wear" },
  { value: "NEEDS_REPAIR", label: "Needs repair" },
];

export function CheckinButton({ checkoutId, toolName }: { checkoutId: string; toolName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [condition, setCondition] = useState("GOOD");
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      await checkinToolAction(checkoutId, condition);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">Check in</Button>
      </DialogTrigger>
      <DialogContent title={`Return "${toolName}"`} description="Select the condition of the tool at return.">
        <div className="space-y-4">
          <Select
            label="Return condition"
            options={CONDITION_OPTIONS}
            value={condition}
            onChange={(e) => setCondition(e.target.value)}
          />
          <div className="flex gap-2 pt-2">
            <Button onClick={handleConfirm} isLoading={isPending}>Confirm return</Button>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
