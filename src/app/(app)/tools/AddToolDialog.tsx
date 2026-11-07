"use client";

import { usePageAction } from "@/components/page-actions";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { NewToolForm } from "./new/NewToolForm";

/** `action`: opened by that page action (the header) instead of its own button */
export function AddToolDialog({ names = [], action }: { names?: string[]; action?: string }) {
  const [open, setOpen] = useState(false);
  usePageAction(action, () => setOpen(true));
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!action && (
        <DialogTrigger asChild>
          <Button size="sm">+ Add tool</Button>
        </DialogTrigger>
      )}
      <DialogContent title="Add tool" className="sm:max-w-xl">
        <NewToolForm names={names} onClose={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
