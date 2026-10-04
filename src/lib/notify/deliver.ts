// Central notification delivery. Every notification in the app goes through here:
// it applies each recipient's per-topic preferences, writes the in-app
// notification, and sends web push to their devices. Server-only.

import webpush from "web-push";
import { prisma } from "@/lib/prisma";
import type { NotificationType, Role } from "@/generated/prisma";
import { TOPIC_BY_ID, type TopicId } from "./topics";
import { FALLBACK_TIMEZONE, inQuietHours, isValidTimezone, localParts } from "./time";

export interface OutgoingNotification {
  topic: TopicId;
  type:  NotificationType;
  title: string;
  body?: string;
  url?:  string;
  /** Devices replace an earlier push with the same tag instead of stacking them */
  tag?:  string;
  /** Push even during the recipient's quiet hours (emergencies only) */
  bypassQuietHours?: boolean;
}

export interface DeliveryResult {
  inApp:  number;
  pushed: number;
}

let vapidReady: boolean | null = null;

function pushConfigured(): boolean {
  if (vapidReady !== null) return vapidReady;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return (vapidReady = false);
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@example.com", pub, priv);
  return (vapidReady = true);
}

/** Send one notification to specific users (inactive users are skipped). */
export async function notifyUsers(userIds: string[], n: OutgoingNotification): Promise<DeliveryResult> {
  const ids = [...new Set(userIds)];
  if (ids.length === 0) return { inApp: 0, pushed: 0 };

  const topic = TOPIC_BY_ID[n.topic];
  const users = await prisma.user.findMany({
    where: { id: { in: ids }, status: "ACTIVE" },
    select: {
      id: true, timezone: true, quietHoursStart: true, quietHoursEnd: true,
      team: { select: { timezone: true } },
      notificationPrefs: { where: { topic: n.topic }, select: { inApp: true, push: true } },
      pushSubscriptions: { select: { id: true, endpoint: true, p256dh: true, auth: true } },
    },
  });

  const inAppIds: string[] = [];
  const pushTargets: { id: string; endpoint: string; p256dh: string; auth: string }[] = [];
  const now = new Date();

  for (const u of users) {
    const pref = u.notificationPrefs[0];
    const wantsInApp = topic?.required || (pref?.inApp ?? topic?.defaultInApp ?? true);
    const wantsPush  = pref?.push ?? topic?.defaultPush ?? false;
    if (wantsInApp) inAppIds.push(u.id);

    if (wantsPush && u.pushSubscriptions.length > 0) {
      const tz = [u.timezone, u.team?.timezone].find(isValidTimezone) ?? FALLBACK_TIMEZONE;
      const quiet = inQuietHours(localParts(now, tz).hour, u.quietHoursStart, u.quietHoursEnd);
      if (!quiet || n.bypassQuietHours) pushTargets.push(...u.pushSubscriptions);
    }
  }

  if (inAppIds.length > 0) {
    await prisma.notification.createMany({
      data: inAppIds.map((userId) => ({
        userId, type: n.type, topic: n.topic, title: n.title, body: n.body, linkUrl: n.url,
      })),
    });
  }

  const pushed = await sendPush(pushTargets, n);
  return { inApp: inAppIds.length, pushed };
}

/** Send to every active team member holding any of `roles` (or everyone with "all"). */
export async function notifyRoles(
  teamId: string,
  roles: Role[] | "all",
  n: OutgoingNotification,
  opts: { exclude?: string[] } = {},
): Promise<DeliveryResult> {
  if (roles !== "all" && roles.length === 0) return { inApp: 0, pushed: 0 };
  const users = await prisma.user.findMany({
    where: {
      teamId,
      status: "ACTIVE",
      ...(roles === "all" ? {} : { roles: { some: { role: { in: roles } } } }),
      ...(opts.exclude?.length ? { id: { notIn: opts.exclude } } : {}),
    },
    select: { id: true },
  });
  return notifyUsers(users.map((u) => u.id), n);
}

async function sendPush(
  targets: { id: string; endpoint: string; p256dh: string; auth: string }[],
  n: OutgoingNotification,
): Promise<number> {
  if (targets.length === 0 || !pushConfigured()) return 0;

  const payload = JSON.stringify({ title: n.title, body: n.body ?? "", url: n.url ?? "/notifications", tag: n.tag });
  const gone: string[] = [];
  const ok: string[] = [];

  await Promise.allSettled(targets.map(async (s) => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        payload,
        { TTL: 60 * 60 * 12, urgency: n.bypassQuietHours ? "high" : "normal" },
      );
      ok.push(s.id);
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      // 404/410: the browser revoked or expired this subscription — stop using it
      if (status === 404 || status === 410) gone.push(s.id);
    }
  }));

  if (gone.length) await prisma.pushSubscription.deleteMany({ where: { id: { in: gone } } });
  if (ok.length)   await prisma.pushSubscription.updateMany({ where: { id: { in: ok } }, data: { lastSuccessAt: new Date() } });
  return ok.length;
}
