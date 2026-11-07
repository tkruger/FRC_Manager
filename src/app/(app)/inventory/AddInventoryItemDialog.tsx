"use client";

import { usePageAction } from "@/components/page-actions";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { NewBaseItemForm } from "./base/new/NewBaseItemForm";

interface Props {
  vendors?: { id: string; name: string }[];
  /** Opened by this page action (the header) instead of its own button */
  action?: string;
}

export function AddInventoryItemDialog({ vendors = [], action }: Props) {
  const [open, setOpen] = useState(false);
  usePageAction(action, () => setOpen(true));
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!action && (
        <DialogTrigger asChild>
          <Button size="sm">+ Add item</Button>
        </DialogTrigger>
      )}
      <DialogContent title="Add inventory item" className="sm:max-w-xl">
        <NewBaseItemForm vendors={vendors} onClose={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
