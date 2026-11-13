"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { saveMouserKeyAction, saveTrack123KeyAction } from "@/app/actions/frc-settings";

const SERVICES = {
  // Fills in Mouser links on orders (description, part number, price)
  mouser:   { name: "Mouser",   placeholder: "Mouser Search API key", save: saveMouserKeyAction },
  // Follows tracking numbers and tells the order when a package is delivered
  track123: { name: "Track123", placeholder: "Track123 API key",      save: saveTrack123KeyAction },
};

/** A team API key for a service the app looks things up with: save, replace or remove it */
export function MouserKeyForm({ saved, canEdit, service = "mouser" }: { saved: boolean; canEdit: boolean; service?: keyof typeof SERVICES }) {
  const router = useRouter();
  const [key, setKey] = useState("");
  const [pending, start] = useTransition();
  if (!canEdit) return null;
  const s = SERVICES[service];

  const save = (value: string, done: string) => start(async () => {
    const res = await s.save(value);
    if (!res.success) { toast.error(res.error); return; }
    setKey("");
    toast.success(done);
    router.refresh();
  });

  return (
    <form className="mt-3 flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); if (key.trim()) save(key, `${s.name} key saved`); }}>
      <input
        className="h-9 min-w-0 flex-1 rounded-md border border-(--color-border) bg-(--color-surface) px-3 text-sm text-(--color-text-primary) focus:border-(--color-primary) focus:outline-none"
        type="password" autoComplete="off" spellCheck={false}
        placeholder={saved ? "Saved — paste a new key to replace it" : s.placeholder}
        value={key} onChange={(e) => setKey(e.target.value)} aria-label={s.placeholder}
      />
      <Button type="submit" size="sm" isLoading={pending} disabled={!key.trim()}>Save</Button>
      {saved && (
        <Button type="button" size="sm" variant="danger" disabled={pending}
          onClick={() => { if (confirm(`Remove the team's ${s.name} key?`)) save("", `${s.name} key removed`); }}>
          Remove
        </Button>
      )}
    </form>
  );
}
