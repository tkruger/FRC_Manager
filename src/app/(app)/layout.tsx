import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { TopNav } from "@/components/layout/TopNav";
import { prisma } from "@/lib/prisma";
import { AnimatedBackground } from "@/components/providers/AnimatedBackground";
import { PushPrompt } from "@/components/notifications/PushPrompt";
import { InstallPrompt } from "@/components/InstallPrompt";
import { Toaster } from "@/components/ui/toast";
import { ViewOnlyBanner, ViewOnlyProvider } from "@/components/access/ViewOnly";
import { isViewOnly } from "@/lib/access/read-only";
import { isCleared } from "@/lib/volunteers";
import { isTestSite } from "@/lib/test-site";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");
  // Signed up with Google or Discord: choose a team first, then wait to be approved
  if (session.user.status === "PENDING") redirect(session.user.teamId ? "/pending" : "/register/finish");

  let pendingMemberCount = 0;
  let unreadNotificationCount = 0;
  let activeSeasonName: string | null = null;
  const viewOnly = isViewOnly(session.user.roles);
  let canVolunteer = false;

  if (session.user.teamId) {
    const isAdmin = session.user.roles.some((r) => ["HEAD_MENTOR", "TEAM_LEADERSHIP"].includes(r));

    const [activeSeason, pendingCount, unreadCount, me] = await Promise.all([
      prisma.season.findFirst({ where: { teamId: session.user.teamId, isActive: true }, select: { name: true } }),
      isAdmin
        ? prisma.user.count({ where: { teamId: session.user.teamId, status: "PENDING" } })
        : Promise.resolve(0),
      prisma.notification.count({ where: { userId: session.user.id, read: false } }),
      viewOnly
        ? prisma.user.findUnique({ where: { id: session.user.id }, select: { volunteerClearedAt: true, volunteerClearedUntil: true } })
        : Promise.resolve(null),
    ]);
    canVolunteer = !!me && isCleared(me);

    pendingMemberCount = pendingCount;
    unreadNotificationCount = unreadCount;
    activeSeasonName = activeSeason?.name ?? null;
  }

  return (
    <div className="min-h-screen bg-(--color-surface)">
      {/* Animated background — orbs + mouse follower, sits behind all content */}
      <AnimatedBackground />

      {/* App shell — z-index 1 so it sits above background orbs */}
      <div id="app-shell">
        <TopNav
          session={session}
          pendingMemberCount={pendingMemberCount}
          unreadNotificationCount={unreadNotificationCount}
          activeSeasonName={activeSeasonName}
          testSite={await isTestSite()}
        />
        {/* pt-14 clears the top nav; pb-14 clears the mobile bottom tab bar (hidden on lg+) */}
        <main className="pt-safe-nav pb-14 lg:pb-0">
          {viewOnly && <ViewOnlyBanner canVolunteer={canVolunteer} />}
          <ViewOnlyProvider viewOnly={viewOnly}>{children}</ViewOnlyProvider>
        </main>
        {/* First visit on a device: offer push notifications (once) */}
        <PushPrompt vapidPublicKey={process.env.VAPID_PUBLIC_KEY ?? null} />
        <InstallPrompt />
        {/* "Saved" confirmations after edits */}
        <Toaster />
      </div>
    </div>
  );
}
