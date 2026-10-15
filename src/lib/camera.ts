"use client";

// One shared rear-camera stream for barcode scanning.
//
// iOS (especially the home-screen app) asks for camera permission again on many new
// getUserMedia() calls. So instead of stopping the camera after every scan and asking for it
// again on "Scan another", we keep the stream: between scans its track is disabled (the
// camera stops capturing and its indicator goes off), and it's only truly released after a
// couple of idle minutes or when the app goes to the background.

const IDLE_RELEASE_MS = 2 * 60_000;

let stream: MediaStream | null = null;
let pending: Promise<MediaStream> | null = null;
let releaseTimer: ReturnType<typeof setTimeout> | undefined;
let listening = false;

function live(s: MediaStream | null): s is MediaStream {
  return !!s && s.getVideoTracks().some((t) => t.readyState === "live");
}

function stopNow() {
  clearTimeout(releaseTimer);
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
}

function listenForBackground() {
  if (listening || typeof document === "undefined") return;
  listening = true;
  // Never hold the camera while the app isn't on screen
  document.addEventListener("visibilitychange", () => { if (document.hidden) stopNow(); });
  window.addEventListener("pagehide", stopNow);
}

/** The camera, reusing the stream we already have when it's still alive */
export async function acquireCamera(): Promise<MediaStream> {
  clearTimeout(releaseTimer);
  listenForBackground();
  if (live(stream)) {
    stream.getVideoTracks().forEach((t) => { t.enabled = true; });
    return stream;
  }
  // Two scanners mounting at once share one request (and one prompt)
  pending ??= navigator.mediaDevices
    .getUserMedia({ video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } } })
    .then((s) => { stream = s; return s; })
    .finally(() => { pending = null; });
  return pending;
}

/** Done scanning for now: pause the camera, and let it go if it isn't needed again soon */
export function releaseCamera() {
  stream?.getVideoTracks().forEach((t) => { t.enabled = false; });
  clearTimeout(releaseTimer);
  releaseTimer = setTimeout(stopNow, IDLE_RELEASE_MS);
}
