"use client";

import { useState } from "react";
import { Field } from "@/components/ui/field";

/** Sign-up: "I'm a parent" → whose parent they are (sent as `parentOf`) */
export function ParentOfField({ defaultOpen = false, error }: { defaultOpen?: boolean; error?: string }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="space-y-2">
      <label className="flex cursor-pointer items-center gap-2 text-sm text-(--color-text-primary)">
        <input type="checkbox" className="rounded" checked={open} onChange={(e) => setOpen(e.target.checked)} />
        I&apos;m a parent or guardian of a student on the team
      </label>
      {open && (
        <Field
          label="Whose parent are you?"
          name="parentOf"
          maxLength={300}
          placeholder="e.g. Alex Starler, Jamie Starler"
          hint="Your student's first and last name — separate more than one with commas."
          error={error}
        />
      )}
    </div>
  );
}
