"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Dialog, DialogContent, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { sendFeedbackAction } from "@/app/actions/feedback";

// "Give feedback" from anywhere: links (footer, menus) open the one dialog mounted in the app layout.

const OPEN_EVENT = "frc:open-feedback";

export function openFeedback() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

/** A link-styled button that opens the feedback dialog */
export function FeedbackLink({ className, children = "Give feedback", onOpen }: { className?: string; children?: React.ReactNode; onOpen?: () => void }) {
  return (
    <button type="button" className={className} onClick={() => { onOpen?.(); openFeedback(); }}>
      {children}
    </button>
  );
}

const KINDS = [
  { value: "idea",  label: "💡 Idea" },
  { value: "bug",   label: "🐞 Something's wrong" },
  { value: "other", label: "💬 Other" },
];

export function FeedbackDialog() {
  const pathname = usePathname();
  const search = useSearchParams();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState("idea");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    const show = () => { setError(null); setOpen(true); };
    window.addEventListener(OPEN_EVENT, show);
    return () => window.removeEventListener(OPEN_EVENT, show);
  }, []);

  // Where they were: the page they opened it on
  const page = `${pathname}${search.size ? `?${search.toString()}` : ""}`;

  function send(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await sendFeedbackAction({
        message, kind, page,
        userAgent: navigator.userAgent,
        viewport: `${window.innerWidth}×${window.innerHeight}`,
      });
      if (!res.success) { setError(res.error); return; }
      toast.success("Thanks — your feedback was sent");
      setMessage(""); setKind("idea"); setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent title="Give feedback" description="Ideas, problems, anything — it goes straight to the people who build FRC Manager.">
        <form onSubmit={send} className="space-y-4">
          {error && <div className="text-sm text-(--color-danger) bg-(--color-danger)/10 rounded px-3 py-2">{error}</div>}
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Kind of feedback">
            {KINDS.map((k) => (
              <button key={k.value} type="button" role="radio" aria-checked={kind === k.value} onClick={() => setKind(k.value)}
                className={`rounded-full border px-3 py-1 text-sm font-medium transition-colors ${kind === k.value
                  ? "border-(--color-primary) bg-(--color-primary)/10 text-(--color-primary)"
                  : "border-(--color-border) text-(--color-text-secondary) hover:text-(--color-text-primary)"}`}>
                {k.label}
              </button>
            ))}
          </div>
          <label className="block space-y-1.5">
            <span className="block text-sm font-medium text-(--color-text-primary)">Your feedback</span>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5} maxLength={4000} required autoFocus
              placeholder={kind === "bug" ? "What happened, and what did you expect?" : "What's on your mind?"}
              className="w-full rounded-md border border-(--color-border) bg-(--color-surface) px-3 py-2 text-sm text-(--color-text-primary) focus:border-(--color-primary) focus:outline-none" />
          </label>
          <p className="text-small text-(--color-text-secondary)">
            Sent with your name, team, and this page (<code className="break-all">{page}</code>) so we can follow up.
          </p>
          <div className="flex gap-2">
            <Button type="submit" isLoading={pending} disabled={message.trim().length < 3}>Send feedback</Button>
            <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
