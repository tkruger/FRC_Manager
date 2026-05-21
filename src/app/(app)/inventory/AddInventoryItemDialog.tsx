"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { NewBaseItemForm } from "./base/new/NewBaseItemForm";

interface Props {
  vendors?: { id: string; name: string }[];
}

export function AddInventoryItemDialog({ vendors = [] }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">+ Add item</Button>
      </DialogTrigger>
      <DialogContent title="Add inventory item" className="sm:max-w-xl">
        <NewBaseItemForm vendors={vendors} onClose={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
