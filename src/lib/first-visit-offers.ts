// The two first-visit offers — turn on push notifications, add the app to the home screen — shared by
// their own prompts (PushPrompt, InstallPrompt) and the app tour, which offers them as steps. Whichever
// asks, the answer is remembered on this device the same way, so the other doesn't ask again. Client-only.

import { hasSubscription, isIos, isStandalone, pushSupport } from "@/lib/push-client";

// ── Push ────────────────────────────────────────────────────────────────────

const PUSH_KEY = "frc-push-prompt";

export function pushAnswered(): boolean {
  try { return !!localStorage.getItem(PUSH_KEY); } catch { return true; } // no storage → don't nag
}
export function rememberPush(answer: string) {
  try { localStorage.setItem(PUSH_KEY, answer); } catch { /* ignore */ }
}

/**
 * Should this device be asked to turn on notifications? (Remembers the cases where it can't or already
 * has: unsupported, blocked, already on.) "needs-install" iPhones are asked inside the home-screen app.
 */
export async function pushOfferNeeded(vapidPublicKey: string | null): Promise<boolean> {
  if (!vapidPublicKey || pushAnswered()) return false;
  const support = pushSupport();
  if (support === "unsupported") { rememberPush("unsupported"); return false; }
  if (support === "needs-install") return false;
  if (Notification.permission === "denied") { rememberPush("blocked"); return false; }
  if (Notification.permission === "granted" && await hasSubscription().catch(() => false)) { rememberPush("enabled"); return false; }
  return true;
}

// ── Add to home screen ──────────────────────────────────────────────────────

const INSTALL_KEY = "frc-install-prompt";
const INSTALL_SNOOZE_MS = 14 * 86_400_000;

export type Platform =
  | { os: "ios"; browser: "safari" | "chrome" | "firefox" | "edge" }
  | { os: "android"; browser: "chrome" | "samsung" | "firefox" | "other" };

/** Phones and tablets only — computers aren't offered it */
export function detectPlatform(): Platform | null {
  const ua = navigator.userAgent;
  if (isIos()) {
    return { os: "ios", browser: /CriOS/.test(ua) ? "chrome" : /FxiOS/.test(ua) ? "firefox" : /EdgiOS/.test(ua) ? "edge" : "safari" };
  }
  if (/Android/i.test(ua)) {
    return { os: "android", browser: /SamsungBrowser/.test(ua) ? "samsung" : /Firefox/.test(ua) ? "firefox" : /Chrome/.test(ua) ? "chrome" : "other" };
  }
  return null;
}

export function installSnoozed(): boolean {
  try {
    const until = Number(localStorage.getItem(INSTALL_KEY));
    return Number.isFinite(until) && until > Date.now();
  } catch {
    return true;
  }
}
/** "Not now" (or installed): don't offer again for two weeks */
export function snoozeInstall() {
  try { localStorage.setItem(INSTALL_KEY, String(Date.now() + INSTALL_SNOOZE_MS)); } catch { /* ignore */ }
}

export function installOfferNeeded(): Platform | null {
  if (isStandalone() || installSnoozed()) return null;
  return detectPlatform();
}

/** Chrome's install event (not in TypeScript's DOM types) */
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// Android Chrome's one-tap install, kept for whoever offers it (the prompt or the tour)
let installEvent: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
let listening = false;

export function listenForInstall() {
  if (listening || typeof window === "undefined") return;
  listening = true;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    installEvent = e as BeforeInstallPromptEvent;
    listeners.forEach((l) => l());
  });
  window.addEventListener("appinstalled", () => {
    snoozeInstall();
    installEvent = null;
    listeners.forEach((l) => l());
  });
}
export const getInstallEvent = () => installEvent;
export function onInstallChange(l: () => void): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

/** Show the browser's own install dialog; true if they installed */
export async function installNow(): Promise<boolean> {
  const e = installEvent;
  if (!e) return false;
  await e.prompt();
  const { outcome } = await e.userChoice;
  installEvent = null;
  listeners.forEach((l) => l());
  if (outcome === "accepted") snoozeInstall();
  return outcome === "accepted";
}
