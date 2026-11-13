// Track123 (https://www.track123.com) — one API that follows packages across carriers (UPS, FedEx,
// USPS, DHL, …). A team's tracking numbers are registered once (each is one of its plan's monthly
// shipments), then checked from the hourly job until delivered. Server-only.

import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { open } from "@/lib/security/secret-box";

const BASE = "https://api.track123.com/gateway/open-api";
const OK = "00000";
/** Starts every error from a failed call (key refused, over the plan, Track123 down) — worth trying again */
export const CALL_FAILED = "Track123: ";

/** The team's Track123 key, or the deployment's TRACK123_API_KEY as a shared fallback */
export const track123KeyFor = cache(async (teamId: string): Promise<{ key: string; source: "team" | "shared" } | null> => {
  const row = await prisma.teamVendorKeys.findUnique({ where: { teamId }, select: { track123KeyEnc: true } });
  const own = row?.track123KeyEnc ? open(row.track123KeyEnc) : null;
  if (own) return { key: own, source: "team" };
  const shared = process.env.TRACK123_API_KEY;
  return shared ? { key: shared, source: "shared" } : null;
});

interface Envelope<T> { code?: string; msg?: string; data?: T }
interface Rejected { trackNo?: string; error?: { code?: string; msg?: string } }

async function call<T>(key: string, path: string, body: unknown): Promise<{ ok: true; data: T } | { ok: false; error: string; status: number }> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method:  "POST",
      headers: { "Track123-Api-Secret": key, "Content-Type": "application/json", Accept: "application/json" },
      body:    JSON.stringify(body),
      signal:  AbortSignal.timeout(15_000),
    });
  } catch {
    return { ok: false, error: `${CALL_FAILED}didn't answer.`, status: 0 };
  }
  const json = await res.json().catch(() => null) as Envelope<T> | null;
  if (!res.ok || !json || json.code !== OK) {
    return { ok: false, error: `${CALL_FAILED}${json?.msg || `refused it (HTTP ${res.status}).`}`, status: res.status };
  }
  return { ok: true, data: json.data as T };
}

/** Does Track123 accept this key? (a lookup of a number nobody has registered) */
export async function checkTrack123Key(key: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const r = await queryTrackings(key, ["FRCMANAGERKEYCHECK1"]);
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

/**
 * Start following tracking numbers. Already registered counts as done. Each new number uses one of
 * the plan's monthly shipments.
 */
export async function registerTrackings(key: string, items: { number: string; carrier?: string | null }[]) {
  const r = await call<{ accepted?: unknown[]; rejected?: Rejected[] }>(key, "/tk/v2/track/import",
    items.map((i) => (i.carrier ? { trackNo: i.number, courierCode: i.carrier } : { trackNo: i.number })));
  if (!r.ok) return { ok: false as const, error: r.error };
  // Refused one by one: already registered is fine; anything else is that number's error
  const errors = new Map<string, string>();
  for (const x of r.data?.rejected ?? []) {
    const msg = x.error?.msg ?? "Track123 couldn't follow this number.";
    if (x.trackNo && !/already|exist|repeat|duplicate|imported/i.test(msg)) errors.set(x.trackNo.toUpperCase(), msg);
  }
  return { ok: true as const, errors };
}

/** What Track123 knows about a package */
export interface PackageInfo {
  number:           string;
  status:           string | null;
  detail:           string | null;
  carrier:          string | null;
  carrierName:      string | null;
  carrierUrl:       string | null;
  expectedDelivery: Date | null;
  deliveredAt:      Date | null;
}

interface Carrier { courierCode?: string; courierNameEN?: string; courierTrackingLink?: string; trackingDetails?: { eventDetail?: string; eventTime?: string; eventTimeZeroUTC?: string }[] }
interface Content {
  trackNo?: string; transitStatus?: string; deliveredTime?: string; expectedDelivery?: string;
  localLogisticsInfo?: Carrier; lastMileInfo?: { openApiWayBillInfo?: Carrier } | null;
}

// Track123's times: "2024-03-01 12:30:00" (UTC unless the carrier gave a zone) or ISO
function toDate(v: string | null | undefined): Date | null {
  if (!v) return null;
  const d = new Date(/^\d{4}-\d\d-\d\d \d/.test(v) ? v.replace(" ", "T") + "Z" : v);
  return isNaN(d.getTime()) ? null : d;
}

function toInfo(c: Content): PackageInfo | null {
  if (!c.trackNo) return null;
  const local = c.localLogisticsInfo ?? {};
  const last = c.lastMileInfo?.openApiWayBillInfo ?? null;
  const events = [...(last?.trackingDetails ?? []), ...(local.trackingDetails ?? [])];
  // Newest first within each carrier; take the newest overall
  const newest = events.sort((a, b) =>
    (toDate(b.eventTimeZeroUTC ?? b.eventTime)?.getTime() ?? 0) - (toDate(a.eventTimeZeroUTC ?? a.eventTime)?.getTime() ?? 0))[0];
  const status = c.transitStatus?.toUpperCase() || null;
  return {
    number:           c.trackNo.toUpperCase(),
    status,
    detail:           newest?.eventDetail?.slice(0, 300) ?? null,
    carrier:          local.courierCode ?? null,
    carrierName:      local.courierNameEN ?? null,
    carrierUrl:       local.courierTrackingLink ?? null,
    expectedDelivery: toDate(c.expectedDelivery),
    deliveredAt:      toDate(c.deliveredTime) ?? (status === "DELIVERED" ? new Date() : null),
  };
}

/** Look up to 100 registered numbers at a time */
export async function queryTrackings(key: string, numbers: string[]) {
  type Data = { accepted?: { content?: Content[] } | Content[] };
  let r = await call<Data>(key, "/tk/v2.1/track/query", { trackNoInfos: numbers.map((trackNo) => ({ trackNo })), queryPageSize: 100 });
  // The older form of the same lookup
  if (!r.ok && r.status === 404) r = await call<Data>(key, "/tk/v2/track/query", { trackNos: numbers });
  if (!r.ok) return { ok: false as const, error: r.error };
  const accepted = r.data?.accepted;
  const content = Array.isArray(accepted) ? accepted : accepted?.content ?? [];
  return { ok: true as const, packages: content.map(toInfo).filter((p): p is PackageInfo => !!p) };
}
