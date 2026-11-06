"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { saveMouserKeyAction } from "@/app/actions/frc-settings";

/** The team's Mouser Search API key — fills in Mouser links on orders (description, part number, price) */
export function MouserKeyForm({ saved, canEdit }: { saved: boolean; canEdit: boolean }) {
  const router = useRouter();
  const [key, setKey] = useState("");
  const [pending, start] = useTransition();
  if (!canEdit) return null;

  const save = (value: string, done: string) => start(async () => {
    const res = await saveMouserKeyAction(value);
    if (!res.success) { toast.error(res.error); return; }
    setKey("");
    toast.success(done);
    router.refresh();
  });

  return (
    <form className="mt-3 flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); if (key.trim()) save(key, "Mouser key saved"); }}>
      <input
        className="h-9 min-w-0 flex-1 rounded-md border border-(--color-border) bg-(--color-surface) px-3 text-sm text-(--color-text-primary) focus:border-(--color-primary) focus:outline-none"
        type="password" autoComplete="off" spellCheck={false}
        placeholder={saved ? "Saved — paste a new key to replace it" : "Mouser Search API key"}
        value={key} onChange={(e) => setKey(e.target.value)} aria-label="Mouser Search API key"
      />
      <Button type="submit" size="sm" isLoading={pending} disabled={!key.trim()}>Save</Button>
      {saved && (
        <Button type="button" size="sm" variant="danger" disabled={pending}
          onClick={() => { if (confirm("Remove the team's Mouser key?")) save("", "Mouser key removed"); }}>
          Remove
        </Button>
      )}
    </form>
  );
}
