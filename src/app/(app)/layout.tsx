import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { TopNav } from "@/components/layout/TopNav";
import { prisma } from "@/lib/prisma";
import { getActiveRobotId } from "@/app/actions/robot-context";
import { AnimatedBackground } from "@/components/providers/AnimatedBackground";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");

  let robots: { id: string; displayName: string; status: string }[] = [];
  let pendingMemberCount = 0;
  let unreadNotificationCount = 0;
  let activeSeasonName: string | null = null;
  let activeRobotId: string | null = null;

  if (session.user.teamId) {
    const isAdmin = session.user.roles.includes("HEAD_MENTOR" as any);

    const [activeSeason, pendingCount, unreadCount, savedRobotId] = await Promise.all([
      prisma.season.findFirst({
        where: { teamId: session.user.teamId, isActive: true },
        include: {
          robots: {
            where: { archived: false },
            select: { id: true, displayName: true, status: true },
            orderBy: { createdAt: "asc" },
          },
        },
      }),
      isAdmin
        ? prisma.user.count({ where: { teamId: session.user.teamId, status: "PENDING" } })
        : Promise.resolve(0),
      prisma.notification.count({ where: { userId: session.user.id, read: false } }),
      getActiveRobotId(),
    ]);

    robots = activeSeason?.robots ?? [];
    pendingMemberCount = pendingCount;
    unreadNotificationCount = unreadCount;
    activeSeasonName = activeSeason?.name ?? null;

    // Validate saved robot still exists in the current season
    const robotIds = new Set(robots.map((r) => r.id));
    activeRobotId = savedRobotId && robotIds.has(savedRobotId) ? savedRobotId : null;
  }

  return (
    <div className="min-h-screen bg-[--color-surface]">
      {/* Animated background — orbs + mouse follower, sits behind all content */}
      <AnimatedBackground />

      {/* App shell — z-index 1 so it sits above background orbs */}
      <div id="app-shell">
        <TopNav
          session={session}
          robots={robots}
          activeRobotId={activeRobotId ?? undefined}
          pendingMemberCount={pendingMemberCount}
          unreadNotificationCount={unreadNotificationCount}
          activeSeasonName={activeSeasonName}
        />
        {/* pt-14 clears the top nav; pb-14 clears the mobile bottom tab bar (hidden on lg+) */}
        <main className="pt-14 pb-14 lg:pb-0">{children}</main>
      </div>
    </div>
  );
}
