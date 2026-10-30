"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogTrigger, DialogClose, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { setVolunteerClearanceAction } from "@/app/actions/volunteers";

/** Head Mentors: mark an adult cleared to volunteer (optionally until a date), or not */
export function ClearanceEditor({ userId, name, cleared, until }: { userId: string; name: string; cleared: boolean; until: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [on, setOn] = useState(cleared);
  const [date, setDate] = useState(until?.slice(0, 10) ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function save() {
    setError(null);
    start(async () => {
      const res = await setVolunteerClearanceAction({ userId, cleared: on, until: on && date ? date : null });
      if (!res.success) { setError(res.error); return; }
      toast.success(on ? `${name} is cleared to volunteer` : `${name} is no longer cleared to volunteer`);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) { setOn(cleared); setDate(until?.slice(0, 10) ?? ""); setError(null); } }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">Volunteer clearance</Button>
      </DialogTrigger>
      <DialogContent title="Cleared to volunteer?" description={`Only cleared adults can sign up to cover meetings. Mark ${name} cleared once your school's requirements (such as a background check) are done.`}>
        <div className="space-y-4">
          {error && <div className="text-sm text-(--color-danger) bg-(--color-danger)/10 rounded px-3 py-2">{error}</div>}
          <label className="flex items-center gap-3 cursor-pointer text-sm text-(--color-text-primary)">
            <input type="checkbox" className="accent-(--color-primary)" checked={on} onChange={(e) => setOn(e.target.checked)} />
            Cleared to volunteer
          </label>
          {on && (
            <label className="block space-y-1.5">
              <span className="block text-sm font-medium text-(--color-text-primary)">Good until <span className="font-normal text-(--color-text-secondary)">(optional — e.g. when the background check runs out)</span></span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                className="h-10 rounded-md border border-(--color-border) bg-(--color-surface) px-3 text-sm text-(--color-text-primary)" />
            </label>
          )}
          {!on && cleared && <p className="text-small text-(--color-text-secondary)">They&apos;ll be taken off any upcoming shifts.</p>}
          <DialogFooter>
            <Button onClick={save} isLoading={pending}>Save</Button>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
