import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { LEADERSHIP_ROLES } from "@/lib/rbac";
import { TOPICS } from "@/lib/notify/topics";
import { FALLBACK_TIMEZONE } from "@/lib/notify/time";
import { PushDeviceCard } from "./PushDeviceCard";
import { TopicPreferences } from "./TopicPreferences";
import { DeliverySettings } from "./DeliverySettings";
import { HelpLink } from "@/components/HelpLink";

export default async function NotificationSettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [user, prefs, deviceCount] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where:  { id: session.user.id },
      select: { timezone: true, quietHoursStart: true, quietHoursEnd: true, team: { select: { timezone: true } } },
    }),
    prisma.notificationPreference.findMany({ where: { userId: session.user.id } }),
    prisma.pushSubscription.count({ where: { userId: session.user.id } }),
  ]);

  const byTopic = new Map(prefs.map((p) => [p.topic, p]));
  const topics = TOPICS.map((t) => ({
    id: t.id, group: t.group, label: t.label, description: t.description, audience: t.audience,
    required: "required" in t && t.required,
    inApp: byTopic.get(t.id)?.inApp ?? t.defaultInApp,
    push:  byTopic.get(t.id)?.push  ?? t.defaultPush,
  }));

  const isLeadership = session.user.roles.some((r) => LEADERSHIP_ROLES.includes(r));

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div>
        <h1 className="text-h1 text-(--color-text-primary) flex items-center gap-2">Notifications <HelpLink topic="notifications" /></h1>
        <p className="text-body text-(--color-text-secondary) mt-1">
          Choose what you hear about, and whether it shows up in the app, as a push notification, or both.
        </p>
      </div>

      <PushDeviceCard
        vapidPublicKey={process.env.VAPID_PUBLIC_KEY ?? null}
        deviceCount={deviceCount}
      />

      <TopicPreferences topics={topics} />

      <DeliverySettings
        quietHoursStart={user.quietHoursStart}
        quietHoursEnd={user.quietHoursEnd}
        timezone={user.timezone}
        teamTimezone={user.team?.timezone ?? null}
        fallbackTimezone={FALLBACK_TIMEZONE}
        canSetTeamTimezone={isLeadership}
      />
    </div>
  );
}
