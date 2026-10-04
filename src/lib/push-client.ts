// Browser-side web push helpers, shared by the first-run prompt and Settings → Notifications.
// Only call these from client components (they use window/navigator).

import { savePushSubscriptionAction } from "@/app/actions/notification-settings";

export type PushSupport =
  | "supported"
  | "needs-install" // iPhone/iPad in Safari: push only works from the home-screen app
  | "unsupported";

export function isIos() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function pushSupport(): PushSupport {
  const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (supported) return "supported";
  return isIos() && !isStandalone() ? "needs-install" : "unsupported";
}

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** The service worker registration (registers it if needed). */
export async function getRegistration() {
  return navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
}

/** Is this device already subscribed to push? */
export async function hasSubscription(): Promise<boolean> {
  if (pushSupport() !== "supported") return false;
  const reg = await getRegistration();
  return !!(await reg.pushManager.getSubscription());
}

export type EnableResult = "enabled" | "denied" | "dismissed";

/**
 * Asks for permission (must run from a tap/click), subscribes this device and
 * saves the subscription. Throws with a readable message if something fails.
 */
export async function enablePush(vapidPublicKey: string): Promise<EnableResult> {
  const permission = await Notification.requestPermission();
  if (permission === "denied") return "denied";
  if (permission !== "granted") return "dismissed";

  await getRegistration();
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
  return "enabled";
}
