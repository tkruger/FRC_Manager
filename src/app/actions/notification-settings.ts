"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { LEADERSHIP_ROLES } from "@/lib/rbac";
import { TOPIC_BY_ID } from "@/lib/notify/topics";
import { notifyUsers } from "@/lib/notify/deliver";
import { FALLBACK_TIMEZONE, isValidTimezone, localParts, zonedTimeToUtc } from "@/lib/notify/time";
import { eventWindow } from "@/lib/frc/event-live";
import { plainArgs, plainObject } from "@/lib/action-args";

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
  plainArgs(timezone, userAgent);
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
  plainArgs(endpoint);
  const session = await currentUser();
  if (!session) return { success: false, error: "Not authenticated." };
  await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: session.user.id } });
  revalidatePath("/settings/notifications");
  return { success: true };
}

export async function setTopicPreferenceAction(topic: string, inApp: boolean, push: boolean, email?: boolean): Promise<Result> {
  plainArgs(topic, inApp, push, email);
  const session = await currentUser();
  if (!session) return { success: false, error: "Not authenticated." };
  const def = TOPIC_BY_ID[topic];
  if (!def) return { success: false, error: "Unknown notification type." };

  const effectiveInApp = def.required ? true : inApp;
  // Email only for topics that can send it
  const mail = def.defaultEmail !== undefined && typeof email === "boolean" ? { email } : {};
  await prisma.notificationPreference.upsert({
    where:  { userId_topic: { userId: session.user.id, topic } },
    create: { userId: session.user.id, topic, inApp: effectiveInApp, push, ...mail },
    update: { inApp: effectiveInApp, push, ...mail },
  });
  return { success: true };
}

const HOUR = z.number().int().min(0).max(23);

export async function saveDeliverySettingsAction(input: {
  quietHoursStart: number;
  quietHoursEnd:   number;
  timezone:        string | null;
}): Promise<Result> {
  plainObject(input);
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
  plainArgs(timezone);
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

/**
 * Snooze competition alerts — for when you're not at the event. Pushes and emails stop; they still
 * show in the app. "2h", "morning" (7am tomorrow your time), "days" (7am, `days` days from now — 1 to
 * 30), "event" (until the competition happening now ends), or "off".
 */
export async function snoozeCompetitionAlertsAction(choice: "2h" | "morning" | "days" | "event" | "off", days = 1): Promise<{ success: true; until: string | null } | { success: false; error: string }> {
  plainArgs(choice, days);
  const session = await currentUser();
  if (!session?.user.teamId) return { success: false, error: "Not authenticated." };
  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { timezone: true, team: { select: { timezone: true } } } });
  const tz = [me?.timezone, me?.team?.timezone].find(isValidTimezone) ?? FALLBACK_TIMEZONE;
  const now = new Date();
  let until: Date | null = null;

  if (choice === "2h") until = new Date(now.getTime() + 2 * 3_600_000);
  else if (choice === "morning" || choice === "days") {
    const n = choice === "morning" ? 1 : Math.trunc(Number(days));
    if (!(n >= 1 && n <= 30)) return { success: false, error: "Pick between 1 and 30 days." };
    const today = localParts(now, tz).dateKey;
    const [y, m, d] = today.split("-").map(Number);
    const tomorrow = new Date(Date.UTC(y, m - 1, d + n));
    until = zonedTimeToUtc(tomorrow.getUTCFullYear(), tomorrow.getUTCMonth() + 1, tomorrow.getUTCDate(), 7, 0, tz);
  } else if (choice === "event") {
    const todayKey = localParts(now, tz).dateKey;
    const comps = await prisma.competitionEvent.findMany({
      where:  { season: { teamId: session.user.teamId }, endDate: { gte: new Date(now.getTime() - 2 * 86_400_000) }, startDate: { lte: new Date(now.getTime() + 86_400_000) } },
      select: { endDate: true, startDate: true },
    });
    const live = comps.find((c) => eventWindow(todayKey, c.startDate, c.endDate) === "live");
    if (!live) return { success: false, error: "There's no competition on right now." };
    // Midnight after its last day, in your time zone
    const last = new Date(live.endDate.getTime() + 86_400_000);
    until = zonedTimeToUtc(last.getUTCFullYear(), last.getUTCMonth() + 1, last.getUTCDate(), 0, 0, tz);
  } else if (choice !== "off") return { success: false, error: "Unknown choice." };

  await prisma.user.update({ where: { id: session.user.id }, data: { competitionSnoozeUntil: until } });
  revalidatePath("/settings/notifications");
  revalidatePath("/competitions", "layout");
  return { success: true, until: until?.toISOString() ?? null };
}
