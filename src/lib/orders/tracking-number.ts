// Tracking numbers: read one from a carrier's tracking link, or take one typed in, and how a
// package's status reads. Safe to import on server and client.

import { isWebUrl } from "@/lib/web-url";

/** Looks like a tracking number: 8–40 letters and digits (spaces and dashes are dropped) */
export function cleanTrackingNumber(v: string): string | null {
  const s = v.replace(/[\s-]/g, "").toUpperCase();
  return /^[A-Z0-9]{8,40}$/.test(s) && /\d/.test(s) ? s : null;
}

// Query parameters carriers put the number in (UPS, FedEx, USPS, DHL, OnTrac, LaserShip, Canada Post…)
const NUMBER_PARAMS = [
  "tracknum", "tracknums", "trknbr", "tracknumbers", "tracknumber", "trackingnumber", "tracking_number",
  "trackingnumbers", "tracking-id", "trackingid", "tlabels", "qtc_tlabels1", "inquirynumber1", "awb",
  "number", "numbers", "id", "pin", "ref", "trackno", "trackid",
];

// Carriers' own number shapes, for links that carry it in the path
const NUMBER_SHAPES = [
  /\b1Z[0-9A-Z]{16}\b/i,         // UPS
  /\b9[2-5]\d{18,26}\b/,         // USPS
  /\b(?:\d{12}|\d{15}|\d{20}|\d{22})\b/, // FedEx and others
  /\b[A-Z]{2}\d{9}[A-Z]{2}\b/,   // international post (e.g. LZ123456789US)
];

/** The tracking number in a carrier's tracking link, if one can be found */
export function numberFromTrackingUrl(link: string): string | null {
  let url: URL;
  try { url = new URL(link); } catch { return null; }
  for (const [k, v] of url.searchParams) {
    if (!NUMBER_PARAMS.includes(k.toLowerCase())) continue;
    // Several numbers in one link (comma-separated): the first
    const n = cleanTrackingNumber(v.split(/[,|]/)[0]);
    if (n) return n;
  }
  const path = decodeURIComponent(url.pathname);
  for (const shape of NUMBER_SHAPES) {
    const m = path.match(shape);
    if (m) return m[0].toUpperCase();
  }
  // The last path segment, when it looks like a number (…/track/1234567890)
  const last = path.split("/").filter(Boolean).pop();
  return last ? cleanTrackingNumber(last) : null;
}

/** What the Buyer typed: a link (with the number read from it, if it has one) or a bare number */
export function parseTrackingInput(input: string): { url: string | null; number: string | null } | null {
  const v = input.trim();
  if (!v) return null;
  if (isWebUrl(v)) return { url: v, number: numberFromTrackingUrl(v) };
  const number = cleanTrackingNumber(v);
  return number ? { url: null, number } : null;
}

/** Track123's transit statuses, as they read in the app */
export const PACKAGE_STATUS: Record<string, { label: string; badge: "neutral" | "info" | "warning" | "success" | "danger" }> = {
  NO_RECORD:        { label: "Waiting for the carrier", badge: "neutral" },
  INFO_RECEIVED:    { label: "Label created",           badge: "neutral" },
  IN_TRANSIT:       { label: "In transit",              badge: "info" },
  WAITING_DELIVERY: { label: "Out for delivery",        badge: "info" },
  OUT_FOR_DELIVERY: { label: "Out for delivery",        badge: "info" },
  AVAILABLE_FOR_PICKUP: { label: "Ready for pickup",    badge: "warning" },
  DELIVERY_FAILED:  { label: "Delivery failed",         badge: "danger" },
  ABNORMAL:         { label: "Problem with delivery",   badge: "danger" },
  EXCEPTION:        { label: "Problem with delivery",   badge: "danger" },
  RETURNED:         { label: "Returned to sender",      badge: "danger" },
  DELIVERED:        { label: "Delivered",               badge: "success" },
  EXPIRED:          { label: "No updates",              badge: "neutral" },
};

export function packageStatus(status: string | null | undefined) {
  if (!status) return null;
  return PACKAGE_STATUS[status.toUpperCase()]
    ?? { label: status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, " "), badge: "neutral" as const };
}
