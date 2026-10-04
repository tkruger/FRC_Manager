"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  savePushSubscriptionAction,
  removePushSubscriptionAction,
  sendTestNotificationAction,
} from "@/app/actions/notification-settings";

type State =
  | "loading"
  | "unsupported"     // browser has no push support
  | "needs-install"   // iPhone/iPad: push only works from the home-screen app
  | "denied"          // user blocked notifications for this site
  | "off"
  | "on";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function isIos() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function PushDeviceCard({ vapidPublicKey, deviceCount }: { vapidPublicKey: string | null; deviceCount: number }) {
  const router = useRouter();
  const [state, setState]   = useState<State>("loading");
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [pending, start]    = useTransition();

  useEffect(() => {
    (async () => {
      const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      if (!supported) {
        setState(isIos() && !isStandalone() ? "needs-install" : "unsupported");
        return;
      }
      if (Notification.permission === "denied") { setState("denied"); return; }
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
      const sub = await reg.pushManager.getSubscription();
      setState(sub ? "on" : "off");
    })().catch(() => setState("unsupported"));
  }, []);

  function enable() {
    setMessage(null);
    start(async () => {
      try {
        if (!vapidPublicKey) throw new Error("Push isn't configured on the server yet.");
        const permission = await Notification.requestPermission();
        if (permission !== "granted") { setState(permission === "denied" ? "denied" : "off"); return; }

        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });
        const res = await savePushSubscriptionAction(
          JSON.parse(JSON.stringify(sub)),
          Intl.DateTimeFormat().resolvedOptions().timeZone,
          navigator.userAgent,
        );
        if (!res.success) throw new Error(res.error);
        setState("on");
        setMessage({ kind: "ok", text: "Push notifications are on for this device." });
        router.refresh();
      } catch (e) {
        setMessage({ kind: "error", text: e instanceof Error ? e.message : "Couldn't turn on push notifications." });
      }
    });
  }

  function disable() {
    setMessage(null);
    start(async () => {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await removePushSubscriptionAction(sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
      router.refresh();
    });
  }

  function test() {
    setMessage(null);
    start(async () => {
      const res = await sendTestNotificationAction();
      setMessage(res.success
        ? { kind: "ok", text: "Sent — it should appear in a few seconds." }
        : { kind: "error", text: res.error });
    });
  }

  return (
    <section className="card space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-h3 text-(--color-text-primary)">Push notifications on this device</h2>
          <p className="text-small text-(--color-text-secondary) mt-0.5">
            {deviceCount === 0
              ? "No devices are set up for push yet."
              : `Push is on for ${deviceCount} of your device${deviceCount === 1 ? "" : "s"}.`}
          </p>
        </div>
        <div className="flex gap-2">
          {state === "on" && (
            <>
              <Button size="sm" variant="outline" onClick={test} disabled={pending}>Send test</Button>
              <Button size="sm" variant="outline" onClick={disable} disabled={pending}>Turn off</Button>
            </>
          )}
          {state === "off" && (
            <Button size="sm" onClick={enable} isLoading={pending}>Turn on push</Button>
          )}
        </div>
      </div>

      {state === "needs-install" && (
        <p className="text-small text-(--color-text-primary) rounded-md bg-(--color-surface-overlay) px-3 py-2">
          On iPhone and iPad, push notifications only work from the installed app. Tap the Share button, choose
          <b> Add to Home Screen</b>, then open FRC Manager from your home screen and come back here.
        </p>
      )}
      {state === "denied" && (
        <p className="text-small text-(--color-text-primary) rounded-md bg-(--color-surface-overlay) px-3 py-2">
          Notifications are blocked for this site. Allow them in your browser or system settings, then reload this page.
        </p>
      )}
      {state === "unsupported" && (
        <p className="text-small text-(--color-text-secondary)">
          This browser doesn&apos;t support push notifications. You&apos;ll still see notifications in the app.
        </p>
      )}
      {message && (
        <p className={`text-sm ${message.kind === "ok" ? "text-(--color-success)" : "text-(--color-danger)"}`}>{message.text}</p>
      )}
    </section>
  );
}
