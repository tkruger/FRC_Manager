"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { pushSupport, hasSubscription, enablePush, isIos } from "@/lib/push-client";

// Asks once per device whether to turn on push notifications. The answer is
// remembered in this device's storage, so a new phone or browser is asked again.
// (On iPhone, the home-screen app has separate storage from Safari, so it's asked
// again after installing — which is when push actually becomes possible.)

const STORAGE_KEY = "frc-push-prompt";
const SHOW_AFTER_MS = 1500;

type Step = "ask" | "install" | "enabled" | "declined" | "blocked";

function remembered(): boolean {
  try { return !!localStorage.getItem(STORAGE_KEY); } catch { return true; } // no storage → don't nag
}
function remember(answer: string) {
  try { localStorage.setItem(STORAGE_KEY, answer); } catch { /* ignore */ }
}

export function PushPrompt({ vapidPublicKey }: { vapidPublicKey: string | null }) {
  const pathname = usePathname();
  const [open, setOpen]       = useState(false);
  const [step, setStep]       = useState<Step>("ask");
  const [busy, setBusy]       = useState(false);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    // Nothing to offer without server keys; no need to ask on the settings page itself
    if (!vapidPublicKey || remembered() || pathname.startsWith("/settings/notifications")) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      const support = pushSupport();
      if (support === "unsupported") { remember("unsupported"); return; }
      // Not installed yet on iPhone: InstallPrompt explains installing; this asks again inside the app
      if (support === "needs-install") return;
      // Already decided at the browser level, or already subscribed on this device
      if (Notification.permission === "denied") { remember("blocked"); return; }
      if (Notification.permission === "granted" && await hasSubscription().catch(() => false)) {
        remember("enabled"); return;
      }
      if (!cancelled) { setStep("ask"); setOpen(true); }
    }, SHOW_AFTER_MS);

    return () => { cancelled = true; clearTimeout(timer); };
    // Only on first load of the app shell
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function turnOn() {
    if (!vapidPublicKey) return;
    setBusy(true);
    setError(null);
    try {
      const result = await enablePush(vapidPublicKey);
      remember(result);
      setStep(result === "enabled" ? "enabled" : result === "denied" ? "blocked" : "declined");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't turn on notifications.");
    } finally {
      setBusy(false);
    }
  }

  function notNow() {
    remember(step === "install" ? "install-later" : "declined");
    setStep("declined");
  }

  function close() {
    // Closing the dialog any other way counts as "not now"
    if (step === "ask" || step === "install") remember(step === "install" ? "install-later" : "declined");
    setOpen(false);
  }

  const settingsLink = (
    <Link href="/settings/notifications" onClick={() => setOpen(false)} className="font-medium text-(--color-secondary) underline">
      Settings → Notifications
    </Link>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent title={TITLES[step]} className="sm:max-w-md">
        <div className="space-y-4 text-sm text-(--color-text-primary)">
          {step === "ask" && (
            <>
              <p>Get a heads-up on this device when something needs you:</p>
              <ul className="list-disc pl-5 space-y-1 text-(--color-text-secondary)">
                <li>orders waiting on your approval</li>
                <li>meeting reminders and schedule changes</li>
                <li>tasks you&apos;re assigned, and ones coming due</li>
                <li>a countdown to each competition</li>
              </ul>
              <p className="text-small text-(--color-text-secondary)">
                Not now? You can change your mind any time in {settingsLink}, where you can also pick exactly which
                notifications you get and set quiet hours.
              </p>
              {error && <p className="text-sm text-(--color-danger)">{error}</p>}
              <div className="flex flex-wrap gap-2">
                <Button onClick={turnOn} isLoading={busy}>Turn on notifications</Button>
                <Button variant="outline" onClick={notNow} disabled={busy}>Not now</Button>
              </div>
            </>
          )}

          {step === "install" && (
            <>
              <p>
                To get notifications on {isIos() ? "iPhone or iPad" : "this device"}, add FRC Manager to your home screen first:
                tap <b>Share</b>, then <b>Add to Home Screen</b>, and open the app from the new icon. You&apos;ll be asked
                about notifications there.
              </p>
              <p className="text-small text-(--color-text-secondary)">
                You can also turn them on later in {settingsLink}.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button onClick={notNow}>Got it</Button>
              </div>
            </>
          )}

          {step === "enabled" && (
            <>
              <p>You&apos;re all set — notifications are on for this device.</p>
              <p className="text-small text-(--color-text-secondary)">
                Choose which ones you get, or set quiet hours, in {settingsLink}.
              </p>
              <Button onClick={() => setOpen(false)}>Done</Button>
            </>
          )}

          {step === "declined" && (
            <>
              <p>No problem — we won&apos;t ask again on this device.</p>
              <p className="text-small text-(--color-text-secondary)">
                If you change your mind, turn them on any time in {settingsLink}.
              </p>
              <Button onClick={() => setOpen(false)}>OK</Button>
            </>
          )}

          {step === "blocked" && (
            <>
              <p>Notifications are blocked for this app in your device settings.</p>
              <p className="text-small text-(--color-text-secondary)">
                To turn them on later, allow notifications for FRC Manager in your phone or browser settings, then go to {settingsLink}.
              </p>
              <Button onClick={() => setOpen(false)}>OK</Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

const TITLES: Record<Step, string> = {
  ask:      "Turn on notifications?",
  install:  "Want notifications on this device?",
  enabled:  "Notifications are on",
  declined: "Notifications are off",
  blocked:  "Notifications are blocked",
};
