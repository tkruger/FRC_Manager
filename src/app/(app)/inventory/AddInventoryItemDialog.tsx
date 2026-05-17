"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { NewBaseItemForm } from "./base/new/NewBaseItemForm";

export function AddInventoryItemDialog() {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">+ Add item</Button>
      </DialogTrigger>
      <DialogContent title="Add inventory item" className="sm:max-w-xl">
        <NewBaseItemForm onClose={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
