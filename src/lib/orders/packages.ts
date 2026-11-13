// Following packages with Track123: register a shipment's tracking number when it's added, check
// on it from the hourly job, and tell everyone on its orders when it's delivered. Server-only.

import { prisma } from "@/lib/prisma";
import { notifyUsers } from "@/lib/notify/deliver";
import { itemRef } from "./constants";
import { CALL_FAILED, queryTrackings, registerTrackings, track123KeyFor, type PackageInfo } from "./track123";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
/** Stop checking a package this long after it was added (lost, or never scanned) */
const FOLLOW_DAYS = 45;
/** A number added before the team had a key is registered when the key is added, if it's this recent */
const LATE_REGISTER_DAYS = 14;

/** Register one shipment's number with the team's Track123 key (quietly does nothing without one) */
export async function registerPackage(trackingId: string): Promise<void> {
  const t = await prisma.tracking.findUnique({ where: { id: trackingId }, select: { id: true, teamId: true, number: true, carrier: true, registeredAt: true } });
  if (!t?.number || t.registeredAt) return;
  const key = await track123KeyFor(t.teamId);
  if (!key) return;
  await registerBatch(key.key, [{ id: t.id, number: t.number, carrier: t.carrier }]);
}

async function registerBatch(key: string, rows: { id: string; number: string; carrier: string | null }[]) {
  const r = await registerTrackings(key, rows);
  const now = new Date();
  if (!r.ok) {
    // The whole call failed (key refused, over the plan's limit, Track123 down): note it, try next hour
    await prisma.tracking.updateMany({ where: { id: { in: rows.map((x) => x.id) } }, data: { trackError: r.error } });
    return 0;
  }
  let registered = 0;
  for (const row of rows) {
    const error = r.errors.get(row.number) ?? null;
    await prisma.tracking.update({
      where: { id: row.id },
      data:  error ? { trackError: error } : { registeredAt: now, trackError: null },
    });
    if (!error) registered++;
  }
  return registered;
}

/**
 * The hourly job: register numbers still waiting (a key added later, or a failed try), then check
 * every package on its way and tell its orders when one is delivered.
 */
export async function checkPackages(): Promise<{ registered: number; checked: number; delivered: number }> {
  const now = Date.now();
  const totals = { registered: 0, checked: 0, delivered: 0 };

  // Teams with packages to register or follow
  const pending = await prisma.tracking.findMany({
    where: {
      number: { not: null }, deliveredAt: null,
      OR: [
        { registeredAt: null, createdAt: { gt: new Date(now - LATE_REGISTER_DAYS * DAY) } },
        { registeredAt: { gt: new Date(now - FOLLOW_DAYS * DAY) } },
      ],
      // Not when every item on it has already been unpacked
      items: { some: { status: { not: "ARRIVED" } } },
    },
    select: { id: true, teamId: true, number: true, carrier: true, registeredAt: true, trackError: true, lastCheckedAt: true },
    take: 2000,
  });

  const byTeam = new Map<string, typeof pending>();
  for (const t of pending) byTeam.set(t.teamId, [...(byTeam.get(t.teamId) ?? []), t]);

  for (const [teamId, rows] of byTeam) {
    const key = await track123KeyFor(teamId).catch(() => null);
    if (!key) continue;

    // Waiting to be registered. A number Track123 refused on its own isn't tried again (that would
    // use up the plan) — a failed call (no key, Track123 down) is.
    const toRegister = rows.filter((t) => !t.registeredAt && (!t.trackError || t.trackError.startsWith(CALL_FAILED))) as { id: string; number: string; carrier: string | null }[];
    for (let i = 0; i < toRegister.length; i += 40) {
      totals.registered += await registerBatch(key.key, toRegister.slice(i, i + 40)).catch(() => 0);
    }

    // On their way: checked about once an hour (Track123 itself refreshes every few hours)
    const toCheck = rows.filter((t) => t.registeredAt && (!t.lastCheckedAt || t.lastCheckedAt.getTime() < now - 50 * 60_000));
    for (let i = 0; i < toCheck.length; i += 100) {
      const batch = toCheck.slice(i, i + 100);
      const r = await queryTrackings(key.key, batch.map((t) => t.number!)).catch(() => null);
      if (!r?.ok) continue;
      const info = new Map(r.packages.map((p) => [p.number, p]));
      for (const t of batch) {
        const p = info.get(t.number!);
        totals.checked++;
        if (await savePackage(t.id, p ?? null)) totals.delivered++;
      }
    }
  }
  return totals;
}

/** Save what Track123 says; true when this is the moment it was delivered */
async function savePackage(id: string, p: PackageInfo | null): Promise<boolean> {
  const now = new Date();
  if (!p) {
    await prisma.tracking.update({ where: { id }, data: { lastCheckedAt: now } });
    return false;
  }
  const before = await prisma.tracking.findUnique({ where: { id }, select: { url: true, carrier: true, deliveredNotifiedAt: true } });
  await prisma.tracking.update({
    where: { id },
    data: {
      lastCheckedAt: now,
      status: p.status, statusDetail: p.detail, expectedDelivery: p.expectedDelivery,
      carrier: before?.carrier ?? p.carrier, carrierName: p.carrierName,
      // Only a number was entered: the carrier's own tracking page
      ...(before?.url ? {} : p.carrierUrl?.startsWith("https://") ? { url: p.carrierUrl } : {}),
      ...(p.deliveredAt ? { deliveredAt: p.deliveredAt } : {}),
    },
  });
  if (!p.deliveredAt || before?.deliveredNotifiedAt) return false;
  // Claimed once, so two runs at the same time can't both send it
  const claimed = await prisma.tracking.updateMany({ where: { id, deliveredNotifiedAt: null }, data: { deliveredNotifiedAt: now } });
  if (claimed.count === 0) return false;
  await tellDelivered(id).catch((e) => console.error("[packages] couldn't send the delivered notice:", e));
  return true;
}

/** Everyone on each order with items in the package: it's here — unpack it and mark it arrived */
async function tellDelivered(trackingId: string) {
  const t = await prisma.tracking.findUnique({
    where:  { id: trackingId },
    select: {
      label: true, carrierName: true,
      items: {
        where:  { status: { not: "ARRIVED" } },
        select: { id: true, orderNumber: true, name: true, requestId: true,
          request: { select: { title: true, requestedById: true, events: { select: { actorId: true } } } } },
      },
    },
  });
  if (!t || t.items.length === 0) return;

  const orders = new Map<string, typeof t.items>();
  for (const i of t.items) orders.set(i.requestId, [...(orders.get(i.requestId) ?? []), i]);
  const what = t.label ? `"${t.label}"` : t.carrierName ? `A ${t.carrierName} package` : "A package";

  for (const [requestId, items] of orders) {
    const order = items[0].request;
    const ids = [...new Set([order.requestedById, ...order.events.map((e) => e.actorId)])].filter((id): id is string => !!id);
    const list = items.map((i) => `${itemRef(i)} ${i.name}`);
    await notifyUsers(ids, {
      topic: "purchase.deliveries",
      type:  "ORDER_RECEIVED",
      title: `📦 Delivered: ${order.title}`,
      body:  `${what} with ${items.length === 1 ? list[0] : `${items.length} items`} was delivered. Mark ${items.length === 1 ? "it" : "them"} arrived once unpacked.`,
      details: list.map((l) => `• ${l}`).join("\n"),
      url:   `/procurement/requests/${requestId}`,
      tag:   `order-delivered-${trackingId}-${requestId}`,
    });
  }
}
