"use client";

import { usePageAction } from "@/components/page-actions";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { NewBaseItemForm } from "./base/new/NewBaseItemForm";
import type { SubcategoryOption } from "./CategoryFields";

interface Props {
  vendors?: { id: string; name: string }[];
  subcategories?: SubcategoryOption[];
  /** Opened by this page action (the header) instead of its own button */
  action?: string;
}

export function AddInventoryItemDialog({ vendors = [], subcategories = [], action }: Props) {
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
        <NewBaseItemForm vendors={vendors} subcategories={subcategories} onClose={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
