"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function SubscribeCalendarButton({ icsUrl }: { icsUrl: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(icsUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const googleUrl = `https://www.google.com/calendar/render?cid=${encodeURIComponent(icsUrl)}`;

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
        </svg>
        Subscribe to calendar
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title="Subscribe to calendar" description="Get live meeting updates in Google Calendar, Apple Calendar, or Outlook.">
          <div className="space-y-5">

            {/* Google Calendar one-click */}
            <div>
              <p className="text-label font-medium text-[--color-text-secondary] uppercase tracking-wide mb-2">Google Calendar</p>
              <a href={googleUrl} target="_blank" rel="noopener noreferrer">
                <Button className="w-full gap-2">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 11.5v2.5h3.5c-.2 1-1.2 3-3.5 3-2.1 0-3.8-1.8-3.8-4s1.7-4 3.8-4c1.2 0 2 .5 2.5 1l1.9-1.8C15.2 7.4 13.8 7 12.2 7 8.8 7 6 9.8 6 13.2c0 3.3 2.7 6 6 6 3.5 0 5.7-2.4 5.7-5.8 0-.5-.1-.8-.1-1.2H12z"/>
                  </svg>
                  Add to Google Calendar
                </Button>
              </a>
            </div>

            {/* ICS URL for Apple / Outlook */}
            <div>
              <p className="text-label font-medium text-[--color-text-secondary] uppercase tracking-wide mb-2">
                Apple Calendar / Outlook / other
              </p>
              <div className="rounded-md border border-[--color-border] bg-[--color-surface-overlay] px-3 py-2.5 flex items-center gap-2">
                <code className="text-xs text-[--color-text-primary] flex-1 truncate">{icsUrl}</code>
                <Button variant="outline" size="sm" onClick={copy} className="shrink-0">
                  {copied ? "Copied ✓" : "Copy"}
                </Button>
              </div>
              <div className="mt-3 space-y-1.5 text-small text-[--color-text-secondary]">
                <p><strong className="text-[--color-text-primary]">Apple Calendar:</strong> File → New Calendar Subscription → paste URL</p>
                <p><strong className="text-[--color-text-primary]">Outlook:</strong> Add calendar → From internet → paste URL</p>
                <p><strong className="text-[--color-text-primary]">Other:</strong> Look for "Subscribe to calendar" or "Add from URL" and paste the link</p>
              </div>
            </div>

            {/* Download */}
            <div className="pt-2 border-t border-[--color-border]">
              <a href={icsUrl} download className="text-small text-[--color-secondary] hover:underline">
                Or download the .ics file to import manually →
              </a>
            </div>

            <DialogClose asChild>
              <Button variant="outline" className="w-full">Done</Button>
            </DialogClose>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
