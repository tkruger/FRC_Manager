import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { LEADERSHIP_ROLES } from "@/lib/rbac";
import { TOPICS } from "@/lib/notify/topics";
import { PushDeviceCard } from "./PushDeviceCard";
import { TopicPreferences } from "./TopicPreferences";
import { DeliverySettings } from "./DeliverySettings";
import { PageTitle } from "@/components/PageHeader";
import type { TopicDef } from "@/lib/notify/topics";
import { canCoordinate, isAdult } from "@/lib/volunteers";
import { canReviewClaims } from "@/lib/expense-claims";
import { teamEmailReady } from "@/lib/email";
import { SnoozeAlerts } from "@/components/competitions/SnoozeAlerts";
import { eventWindow } from "@/lib/frc/event-live";
import { FALLBACK_TIMEZONE, isValidTimezone, localParts } from "@/lib/notify/time";

export default async function NotificationSettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [user, prefs, deviceCount] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where:  { id: session.user.id },
      select: { timezone: true, quietHoursStart: true, quietHoursEnd: true, competitionSnoozeUntil: true, team: { select: { timezone: true } } },
    }),
    prisma.notificationPreference.findMany({ where: { userId: session.user.id } }),
    prisma.pushSubscription.count({ where: { userId: session.user.id } }),
  ]);

  const byTopic = new Map(prefs.map((p) => [p.topic, p]));
  // Platform-admin topics only appear for super admins; volunteer ones for adults and coordinators
  const roles = session.user.roles;
  const shown = (t: TopicDef) =>
    (!t.superAdminOnly || session.user.isSuperAdmin) &&
    (t.volunteers !== "adults" || isAdult(roles) || canCoordinate(roles)) &&
    (t.volunteers !== "coordinators" || canCoordinate(roles)) &&
    (!t.claimReviewers || canReviewClaims(roles));
  const topics = (TOPICS as readonly TopicDef[]).filter(shown).map((t) => ({
    id: t.id, group: t.group, label: t.label, description: t.description, audience: t.audience,
    required: !!t.required,
    inApp: byTopic.get(t.id)?.inApp ?? t.defaultInApp,
    push:  byTopic.get(t.id)?.push  ?? t.defaultPush,
    // null: this topic doesn't email
    email: t.defaultEmail === undefined ? null : byTopic.get(t.id)?.email ?? t.defaultEmail,
  }));

  const isLeadership = session.user.roles.some((r) => LEADERSHIP_ROLES.includes(r));
  // Team notifications are only emailed from the team's own email
  const teamEmail = session.user.teamId ? await teamEmailReady(session.user.teamId) : false;

  // A competition on now? (offers snoozing until it ends)
  const now = new Date();
  const tz = [user.timezone, user.team?.timezone].find(isValidTimezone) ?? FALLBACK_TIMEZONE;
  const comps = session.user.teamId ? await prisma.competitionEvent.findMany({
    where:  { season: { teamId: session.user.teamId }, endDate: { gte: new Date(now.getTime() - 2 * 86_400_000) }, startDate: { lte: new Date(now.getTime() + 86_400_000) } },
    select: { startDate: true, endDate: true },
  }) : [];
  const eventOn = comps.some((c) => eventWindow(localParts(now, tz).dateKey, c.startDate, c.endDate) === "live");

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div>
        <PageTitle help="notifications">Notifications</PageTitle>
        <p className="text-body text-(--color-text-secondary) mt-1">
          Choose what you hear about, and whether it shows up in the app, as a push notification, or both. Volunteer shifts can also come by email.
        </p>
        {!teamEmail && (
          <p className="text-small text-(--color-text-secondary) mt-2">
            Your team hasn&apos;t set up its own email yet, so nothing is emailed for now — the email choices apply once a Head Mentor sets it up.
          </p>
        )}
      </div>

      <PushDeviceCard
        vapidPublicKey={process.env.VAPID_PUBLIC_KEY ?? null}
        deviceCount={deviceCount}
      />

      <section className="card space-y-2">
        <h2 className="text-h3 text-(--color-text-primary)">Snooze competition alerts</h2>
        <p className="text-small text-(--color-text-secondary)">
          Not at an event? Pause its schedule, next-match, result and award alerts for a while instead of turning them off —
          they still collect in your notifications, and come back on by themselves.
        </p>
        <SnoozeAlerts until={user.competitionSnoozeUntil?.toISOString() ?? null} eventOn={eventOn} />
      </section>

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
