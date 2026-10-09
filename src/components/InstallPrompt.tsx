"use client";

import { useEffect, useState } from "react";
import { Share, MoreVertical, Menu, PlusSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { isIos, isStandalone } from "@/lib/push-client";

// Once signed in, on a phone or tablet browser (not the installed app), explain how to add FRC Manager to
// the home screen — only the steps for this device and browser. Android Chrome gets a
// one-tap Install button when the browser offers it. "Not now" waits two weeks.

const STORAGE_KEY = "frc-install-prompt";
const SNOOZE_MS   = 14 * 86_400_000;
const SHOW_AFTER  = 2500;

type Platform =
  | { os: "ios"; browser: "safari" | "chrome" | "firefox" | "edge" }
  | { os: "android"; browser: "chrome" | "samsung" | "firefox" | "other" };

/** Chrome's install event (not in TypeScript's DOM types) */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function detect(): Platform | null {
  const ua = navigator.userAgent;
  if (isIos()) {
    return { os: "ios", browser: /CriOS/.test(ua) ? "chrome" : /FxiOS/.test(ua) ? "firefox" : /EdgiOS/.test(ua) ? "edge" : "safari" };
  }
  if (/Android/i.test(ua)) {
    return { os: "android", browser: /SamsungBrowser/.test(ua) ? "samsung" : /Firefox/.test(ua) ? "firefox" : /Chrome/.test(ua) ? "chrome" : "other" };
  }
  return null; // computers don't get the prompt
}

function snoozed(): boolean {
  try {
    const until = Number(localStorage.getItem(STORAGE_KEY));
    return Number.isFinite(until) && until > Date.now();
  } catch {
    return true; // no storage → don't nag
  }
}
function snooze() {
  try { localStorage.setItem(STORAGE_KEY, String(Date.now() + SNOOZE_MS)); } catch { /* ignore */ }
}

export function InstallPrompt() {
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [open, setOpen]         = useState(false);
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (isStandalone() || snoozed()) return;
    const p = detect();
    if (!p) return;

    // Android Chrome offers a real install dialog — keep the event to trigger it from our button
    function onBeforeInstall(e: Event) {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    }
    function onInstalled() { snooze(); setOpen(false); }
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);

    const timer = setTimeout(() => { setPlatform(p); setOpen(true); }, SHOW_AFTER);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!platform) return null;

  function close() {
    snooze();
    setOpen(false);
  }

  async function installNow() {
    if (!installEvent) return;
    await installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    if (outcome === "accepted") close();
    setInstallEvent(null);
  }

  const steps = stepsFor(platform);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) close(); }}>
      <DialogContent
        title="Add FRC Manager to your home screen"
        description="It opens full screen like a real app, stays signed in, and can send you notifications."
      >
        <div className="space-y-4">
          {installEvent ? (
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

function stepsFor(p: Platform): React.ReactNode[] {
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
