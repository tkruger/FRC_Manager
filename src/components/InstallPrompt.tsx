"use client";

import { useEffect, useRef, useState } from "react";
import { Share, MoreVertical, Menu, PlusSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { releasePrompt, whenFree } from "@/lib/prompt-queue";
import {
  getInstallEvent, installNow as install, installOfferNeeded, installSnoozed, listenForInstall, onInstallChange, snoozeInstall,
  type Platform,
} from "@/lib/first-visit-offers";

// Once signed in, on a phone or tablet browser (not the installed app), explain how to add FRC Manager to
// the home screen — only the steps for this device and browser. Android Chrome gets a
// one-tap Install button when the browser offers it. "Not now" waits two weeks. The app tour offers the
// same as one of its steps; whichever offers first, the other doesn't.

const SHOW_AFTER  = 2500;

export function InstallPrompt() {
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [open, setOpen]         = useState(false);
  const [canInstall, setCanInstall] = useState(false);

  // Taking turns with the other first-visit prompt (src/lib/prompt-queue.ts)
  const shown = useRef(false);
  useEffect(() => {
    if (open) shown.current = true;
    else if (shown.current) { shown.current = false; releasePrompt("install"); }
  }, [open]);
  useEffect(() => () => releasePrompt("install"), []);

  useEffect(() => {
    // Android Chrome offers a real install dialog — kept (in first-visit-offers) for our button
    listenForInstall();
    const off = onInstallChange(() => { setCanInstall(!!getInstallEvent()); if (installSnoozed()) setOpen(false); });
    const p = installOfferNeeded();
    if (!p) return off;
    // After the notifications question (and the app tour, which may offer this itself) — never on top
    const timer = setTimeout(() => {
      setPlatform(p);
      setCanInstall(!!getInstallEvent());
      whenFree("install", () => { if (installSnoozed()) releasePrompt("install"); else setOpen(true); });
    }, SHOW_AFTER);
    return () => { clearTimeout(timer); off(); };
  }, []);

  if (!platform) return null;

  function close() {
    snoozeInstall();
    setOpen(false);
  }

  async function installNow() {
    if (await install()) close();
  }

  const steps = installStepsFor(platform);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) close(); }}>
      <DialogContent
        title="Add FRC Manager to your home screen"
        description="It opens full screen like a real app, stays signed in, and can send you notifications."
      >
        <div className="space-y-4">
          {canInstall ? (
            <Button className="w-full" onClick={installNow}>Install app</Button>
          ) : (
            <ol className="space-y-3">
              {steps.map((s, i) => (
                <li key={i} className="flex gap-3 text-sm text-(--color-text-primary)">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-(--color-primary)/15 text-xs font-bold text-(--color-primary)">{i + 1}</span>
                  <span className="pt-0.5">{s}</span>
                </li>
              ))}
            </ol>
          )}
          {platform.os === "ios" && platform.browser !== "safari" && (
            <p className="text-small text-(--color-text-secondary)">
              Don&apos;t see it? Open this page in Safari and add it from there.
            </p>
          )}
          <Button variant="outline" className="w-full" onClick={close}>Not now</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const icon = "inline h-4 w-4 align-[-3px] mx-0.5";

/** How to add the app to the home screen, for this device and browser */
export function installStepsFor(p: Platform): React.ReactNode[] {
  if (p.os === "ios") {
    const share = <>the <b>Share</b> button <Share className={icon} aria-hidden /></>;
    const where = p.browser === "safari"
      ? <>Tap {share} in the toolbar (on newer iPhones, tap <b>⋯</b> first)</>
      : <>Tap {share} in the address bar</>;
    return [
      where,
      <>Scroll down and tap <b>Add to Home Screen</b> <PlusSquare className={icon} aria-hidden /></>,
      <>Tap <b>Add</b>, then open FRC Manager from your home screen</>,
    ];
  }
  switch (p.browser) {
    case "samsung":
      return [
        <>Tap the menu <Menu className={icon} aria-hidden /> at the bottom</>,
        <>Tap <b>Add page to</b>, then <b>Home screen</b></>,
        <>Open FRC Manager from your home screen</>,
      ];
    case "firefox":
      return [
        <>Tap the menu <MoreVertical className={icon} aria-hidden /></>,
        <>Tap <b>Install</b> (or <b>Add to Home screen</b>)</>,
        <>Open FRC Manager from your home screen</>,
      ];
    default:
      return [
        <>Tap the menu <MoreVertical className={icon} aria-hidden /> at the top right</>,
        <>Tap <b>Add to Home screen</b> or <b>Install app</b></>,
        <>Tap <b>Install</b>, then open FRC Manager from your home screen</>,
      ];
  }
}
