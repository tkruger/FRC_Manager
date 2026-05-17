"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { SeasonForm } from "./SeasonForm";

interface Props {
  hasActiveSeason: boolean;
  label?: string;
}

export function NewSeasonButton({ hasActiveSeason, label }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={hasActiveSeason ? "outline" : "primary"} size="sm">
          {label ?? "+ New season"}
        </Button>
      </DialogTrigger>
      <DialogContent
        title={hasActiveSeason ? "Create new season" : "Set up your first season"}
        description={hasActiveSeason ? "Creating a new season will deactivate the current one." : undefined}
        className="sm:max-w-xl"
      >
        <SeasonForm onClose={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
