"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { NewToolForm } from "./new/NewToolForm";

export function AddToolDialog() {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">+ Add tool</Button>
      </DialogTrigger>
      <DialogContent title="Add tool" className="sm:max-w-xl">
        <NewToolForm onClose={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
