"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Dialog, DialogContent, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getBroadcastAction } from "@/app/actions/broadcast";

// A broadcast message, opened from its notification (?broadcast=…): the whole message on top of
// whatever page it opens.

type Broadcast = { title: string; body: string; from: string | null; sentAt: string };

export function BroadcastOverlay() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const id = params.get("broadcast");
  const [loaded, setLoaded] = useState<{ id: string; b: Broadcast | null; error: string | null } | null>(null);

  useEffect(() => {
    if (!id) return;
    let live = true;
    getBroadcastAction(id).then((res) => {
      if (live) setLoaded({ id, b: res.success ? res.broadcast : null, error: res.success ? null : res.error });
    });
    return () => { live = false; };
  }, [id]);

  const close = () => {
    const next = new URLSearchParams(params.toString());
    next.delete("broadcast");
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
  };
  const current = loaded && loaded.id === id ? loaded : null;
  if (!id || !current) return null;

  return (
    <Dialog open onOpenChange={(o) => !o && close()}>
      <DialogContent
        title={current.b ? `📣 ${current.b.title}` : "Message"}
        description={current.b ? `${current.b.from ?? "A Head Mentor"} · ${new Date(current.b.sentAt).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}` : undefined}>
        {current.b
          ? <div className="max-h-[60vh] overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-(--color-text-primary)">{current.b.body}</div>
          : <p className="text-sm text-(--color-text-secondary)">{current.error}</p>}
        <div className="mt-4 flex justify-end">
          <DialogClose asChild><Button variant="outline" size="sm">Close</Button></DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}
