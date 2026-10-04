"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { LEADERSHIP_ROLES } from "@/lib/rbac";
import { TOPIC_BY_ID } from "@/lib/notify/topics";
import { notifyUsers } from "@/lib/notify/deliver";
import { isValidTimezone } from "@/lib/notify/time";

type Result = { success: true } | { success: false; error: string };

const SubscriptionSchema = z.object({
  endpoint: z.string().url().max(2048),
  keys: z.object({
    p256dh: z.string().min(1).max(512),
    auth:   z.string().min(1).max(512),
  }),
});

async function currentUser() {
  const session = await auth();
  return session?.user?.id ? session : null;
}

export async function savePushSubscriptionAction(
  subscription: unknown,
  timezone: string | null,
  userAgent: string | null,
): Promise<Result> {
  const session = await currentUser();
  if (!session) return { success: false, error: "Not authenticated." };

  const parsed = SubscriptionSchema.safeParse(subscription);
  if (!parsed.success) return { success: false, error: "Invalid push subscription." };
  const { endpoint, keys } = parsed.data;

  // An endpoint belongs to one browser; if someone else used to own it, it's theirs no longer
  await prisma.pushSubscription.upsert({
    where:  { endpoint },
    create: { endpoint, p256dh: keys.p256dh, auth: keys.auth, userId: session.user.id, userAgent: userAgent?.slice(0, 300) },
    update: { p256dh: keys.p256dh, auth: keys.auth, userId: session.user.id, userAgent: userAgent?.slice(0, 300) },
  });

  // Learn the user's time zone from their device the first time they turn push on
  if (isValidTimezone(timezone)) {
    await prisma.user.updateMany({ where: { id: session.user.id, timezone: null }, data: { timezone } });
  }

  revalidatePath("/settings/notifications");
  return { success: true };
}

export async function removePushSubscriptionAction(endpoint: string): Promise<Result> {
  const session = await currentUser();
  if (!session) return { success: false, error: "Not authenticated." };
  await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: session.user.id } });
  revalidatePath("/settings/notifications");
  return { success: true };
}

export async function setTopicPreferenceAction(topic: string, inApp: boolean, push: boolean): Promise<Result> {
  const session = await currentUser();
  if (!session) return { success: false, error: "Not authenticated." };
  const def = TOPIC_BY_ID[topic];
  if (!def) return { success: false, error: "Unknown notification type." };

  const effectiveInApp = def.required ? true : inApp;
  await prisma.notificationPreference.upsert({
    where:  { userId_topic: { userId: session.user.id, topic } },
    create: { userId: session.user.id, topic, inApp: effectiveInApp, push },
    update: { inApp: effectiveInApp, push },
  });
  return { success: true };
}

const HOUR = z.number().int().min(0).max(23);

export async function saveDeliverySettingsAction(input: {
  quietHoursStart: number;
  quietHoursEnd:   number;
  timezone:        string | null;
}): Promise<Result> {
  const session = await currentUser();
  if (!session) return { success: false, error: "Not authenticated." };

  const start = HOUR.safeParse(input.quietHoursStart);
  const end   = HOUR.safeParse(input.quietHoursEnd);
  if (!start.success || !end.success) return { success: false, error: "Choose valid quiet hours." };
  if (input.timezone && !isValidTimezone(input.timezone)) return { success: false, error: "Unknown time zone." };

  await prisma.user.update({
    where: { id: session.user.id },
    data:  { quietHoursStart: start.data, quietHoursEnd: end.data, timezone: input.timezone || null },
  });
  revalidatePath("/settings/notifications");
  return { success: true };
}

export async function setTeamTimezoneAction(timezone: string): Promise<Result> {
  const session = await currentUser();
  if (!session?.user.teamId) return { success: false, error: "Not authenticated." };
  if (!session.user.roles.some((r) => LEADERSHIP_ROLES.includes(r))) {
    return { success: false, error: "Only Head Mentors and Team Leadership can change the team time zone." };
  }
  if (!isValidTimezone(timezone)) return { success: false, error: "Unknown time zone." };

  await prisma.team.update({ where: { id: session.user.teamId }, data: { timezone } });
  revalidatePath("/settings/notifications");
  return { success: true };
}

export async function sendTestNotificationAction(): Promise<Result & { pushed?: number }> {
  const session = await currentUser();
  if (!session) return { success: false, error: "Not authenticated." };

  const devices = await prisma.pushSubscription.count({ where: { userId: session.user.id } });
  const res = await notifyUsers([session.user.id], {
    topic: "account",
    type:  "ACCOUNT_APPROVED",
    title: "🔔 Test notification",
    body:  "Push notifications are working on this device.",
    url:   "/settings/notifications",
    tag:   "test",
    bypassQuietHours: true,
  });
  if (devices > 0 && res.pushed === 0) {
    return { success: false, error: "Couldn't reach any of your devices. Try turning push off and on again." };
  }
  return { success: true, pushed: res.pushed };
}
