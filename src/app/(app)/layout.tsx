import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ScrollReset } from "@/components/layout/ScrollReset";
import { BroadcastOverlay } from "@/components/broadcast/BroadcastOverlay";
import { AppTour } from "@/components/tour/AppTour";
import type { TourAudience } from "@/components/tour/tour-steps";
import { audienceOf } from "@/lib/audience";
import { FeedbackDialog, FeedbackLink } from "@/components/feedback/Feedback";
import { MessageSquareText } from "lucide-react";
import { TopNav } from "@/components/layout/TopNav";
import { prisma } from "@/lib/prisma";
import { AnimatedBackground } from "@/components/providers/AnimatedBackground";
import { PushPrompt } from "@/components/notifications/PushPrompt";
import { InstallPrompt } from "@/components/InstallPrompt";
import { Toaster } from "@/components/ui/toast";
import { ViewportFix } from "@/components/layout/ViewportFix";
import Link from "next/link";
import { SOURCE_URL } from "@/components/legal/LegalPage";
import { APP_VERSION } from "@/lib/version";
import { ViewOnlyBanner, ViewOnlyProvider } from "@/components/access/ViewOnly";
import { isViewOnly } from "@/lib/access/read-only";
import { canCoordinate, isCleared } from "@/lib/volunteers";
import { isTestSite } from "@/lib/test-site";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");
  // Signed up with Google or Discord: choose a team first, then wait to be approved
  // (Their session carries no team until they're approved — see the jwt callback in lib/auth.ts)
  if (session.user.pendingTeam) redirect("/pending");
  if (session.user.status === "PENDING") redirect("/register/finish");

  let pendingMemberCount = 0;
  let unreadNotificationCount = 0;
  let activeSeasonName: string | null = null;
  const viewOnly = isViewOnly(session.user.roles);
  let canVolunteer = false;
  let offerTour = false;
  const roles = session.user.roles as string[];
  const tourAudience: TourAudience = roles.includes("HEAD_MENTOR") ? "head_mentor" : audienceOf(roles);

  if (session.user.teamId) {
    const isAdmin = session.user.roles.some((r) => ["HEAD_MENTOR", "TEAM_LEADERSHIP"].includes(r));

    const [activeSeason, pendingCount, unreadCount, me, tour] = await Promise.all([
      prisma.season.findFirst({ where: { teamId: session.user.teamId, isActive: true }, select: { name: true } }),
      isAdmin
        ? prisma.user.count({ where: { teamId: session.user.teamId, status: "PENDING" } })
        : Promise.resolve(0),
      prisma.notification.count({ where: { userId: session.user.id, read: false } }),
      viewOnly
        ? prisma.user.findUnique({ where: { id: session.user.id }, select: { volunteerClearedAt: true, volunteerClearedUntil: true } })
        : Promise.resolve(null),
      prisma.user.findUnique({ where: { id: session.user.id }, select: { tourSeenAt: true } }),
    ]);
    // The app tour, until they've finished or skipped it
    offerTour = !!tour && !tour.tourSeenAt;
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
        {/* pt-14 clears the top nav; the bottom padding clears the mobile tab bar and the home-indicator space under it (hidden on lg+) */}
        <main className="pt-safe-nav pb-[calc(3.5rem+env(safe-area-inset-bottom,0px))] lg:pb-0">
          {viewOnly && <ViewOnlyBanner canVolunteer={canVolunteer} />}
          <ViewOnlyProvider viewOnly={viewOnly}>{children}</ViewOnlyProvider>
          <footer className="no-print px-4 pb-8 pt-10 text-center text-xs text-(--color-text-secondary)">
            <div className="mb-3">
              <FeedbackLink className="inline-flex items-center gap-1.5 rounded-full bg-(--color-secondary)/10 px-3 py-1.5 text-sm font-medium text-(--color-secondary) ring-1 ring-(--color-secondary)/30 hover:bg-(--color-secondary)/20">
                <MessageSquareText className="h-4 w-4" aria-hidden strokeWidth={2} />
                Give feedback
              </FeedbackLink>
            </div>
            <Link href="/terms" className="hover:text-(--color-primary)">Terms of Service</Link>
            <span className="mx-2">·</span>
            <Link href="/privacy" className="hover:text-(--color-primary)">Privacy Policy</Link>
            <span className="mx-2">·</span>
            <a href={SOURCE_URL} target="_blank" rel="noopener noreferrer" className="hover:text-(--color-primary)">Source code</a>
            <span className="mx-2">·</span>
            <span>v{APP_VERSION}</span>
          </footer>
        </main>
        {/* First visit on a device: offer push notifications (once) */}
        <PushPrompt vapidPublicKey={process.env.VAPID_PUBLIC_KEY ?? null} />
        <InstallPrompt />
        {/* iOS: keeps the tab bar at the bottom after the keyboard closes */}
        <ViewportFix />
        {/* Home-screen app: each page starts at the top of its scroller */}
        <ScrollReset />
        {/* "Saved" confirmations after edits */}
        <Toaster />
        {/* Give feedback — opened from the footer and the profile menu */}
        <Suspense fallback={null}><FeedbackDialog /></Suspense>
        {/* The app tour (first visit to Home; again from the profile menu) */}
        <Suspense fallback={null}><AppTour audience={tourAudience} coordinator={canCoordinate(roles)} offer={offerTour} vapidPublicKey={process.env.VAPID_PUBLIC_KEY ?? null} /></Suspense>
        {/* A broadcast message opened from its notification */}
        <Suspense fallback={null}><BroadcastOverlay /></Suspense>
      </div>
    </div>
  );
}
