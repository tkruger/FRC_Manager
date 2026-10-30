// Central notification delivery. Every notification in the app goes through here:
// it applies each recipient's per-topic preferences, writes the in-app
// notification, sends web push to their devices, and — for topics that can — emails them.
// Server-only.

import webpush from "web-push";
import { prisma } from "@/lib/prisma";
import { rolesThatImply } from "@/lib/rbac";
import type { NotificationType, Role } from "@/generated/prisma";
import { TOPIC_BY_ID, type TopicId } from "./topics";
import { FALLBACK_TIMEZONE, inQuietHours, isValidTimezone, localParts } from "./time";
import { sendEmail, escapeHtml } from "@/lib/email";
import { appUrl } from "@/lib/app-url";

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
  /** More for the email only (e.g. a volunteer shift's instructions) — plain text */
  details?: string;
}

export interface DeliveryResult {
  inApp:  number;
  pushed: number;
  emailed?: number;
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
      id: true, email: true, name: true, timezone: true, quietHoursStart: true, quietHoursEnd: true,
      team: { select: { timezone: true, teamNumber: true } },
      notificationPrefs: { where: { topic: n.topic }, select: { inApp: true, push: true, email: true } },
      pushSubscriptions: { select: { id: true, endpoint: true, p256dh: true, auth: true } },
    },
  });

  const inAppIds: string[] = [];
  const emailTo: { email: string; name: string; teamNumber: number | null }[] = [];
  const pushTargets: { id: string; endpoint: string; p256dh: string; auth: string }[] = [];
  const now = new Date();

  for (const u of users) {
    const pref = u.notificationPrefs[0];
    const wantsInApp = topic?.required || (pref?.inApp ?? topic?.defaultInApp ?? true);
    const wantsPush  = pref?.push ?? topic?.defaultPush ?? false;
    if (wantsInApp) inAppIds.push(u.id);
    // Email: only topics that can send it, and never to placeholder addresses
    const wantsEmail = topic?.defaultEmail !== undefined && (pref?.email ?? topic.defaultEmail);
    if (wantsEmail && !u.email.endsWith(".invalid")) emailTo.push({ email: u.email, name: u.name, teamNumber: u.team?.teamNumber ?? null });

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

  const [pushed, emailed] = await Promise.all([sendPush(pushTargets, n), sendEmails(emailTo, n)]);
  return { inApp: inAppIds.length, pushed, emailed };
}

/** The notification as a short email with a button back to the app */
async function sendEmails(to: { email: string; name: string; teamNumber: number | null }[], n: OutgoingNotification): Promise<number> {
  if (to.length === 0) return 0;
  const url = `${appUrl()}${n.url ?? "/notifications"}`;
  // Emoji at the start of a title read oddly as a subject line
  const subject = n.title.replace(/^[^\p{L}\p{N}"“(]+/u, "").trim() || n.title;
  const results = await Promise.allSettled(to.map((r) => {
    const first = r.name.split(" ")[0] || r.name;
    const team = r.teamNumber ? `Team ${r.teamNumber}` : "your team";
    const parts = [n.body, n.details].filter(Boolean) as string[];
    return sendEmail({
      to: r.email,
      subject,
      text: `Hi ${first},\n\n${subject}\n${parts.length ? "\n" + parts.join("\n\n") + "\n" : ""}\nOpen FRC Manager: ${url}\n\nYou get this because email is on for this kind of notification. Change it in Settings → Notifications.`,
      html: `<div style="font-family:system-ui,sans-serif;max-width:520px;line-height:1.5;color:#1f2430">
        <p>Hi ${escapeHtml(first)},</p>
        <p style="font-size:17px;font-weight:600;margin:0 0 8px">${escapeHtml(subject)}</p>
        ${parts.map((p) => `<p style="white-space:pre-wrap;margin:0 0 12px">${escapeHtml(p)}</p>`).join("")}
        <p><a href="${url}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">Open in FRC Manager</a></p>
        <p style="font-size:12px;color:#666">Sent by FRC Manager for ${escapeHtml(team)}. To stop these emails, turn email off for this notification in Settings → Notifications.</p>
      </div>`,
    });
  }));
  return results.filter((x) => x.status === "fulfilled" && x.value.sent).length;
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
      // Counts roles that imply the ones asked for (none do right now)
      ...(roles === "all" ? {} : { roles: { some: { role: { in: rolesThatImply(roles) } } } }),
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
