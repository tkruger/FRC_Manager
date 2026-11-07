"use client";

import { usePageAction } from "@/components/page-actions";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { SeasonForm } from "./SeasonForm";

interface Props {
  hasActiveSeason: boolean;
  label?: string;
  /** Opened by this page action (the header) instead of its own button */
  action?: string;
}

export function NewSeasonButton({ hasActiveSeason, label, action }: Props) {
  const [open, setOpen] = useState(false);
  usePageAction(action, () => setOpen(true));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!action && (
        <DialogTrigger asChild>
          <Button variant={hasActiveSeason ? "outline" : "primary"} size="sm">
            {label ?? "+ New season"}
          </Button>
        </DialogTrigger>
      )}
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
