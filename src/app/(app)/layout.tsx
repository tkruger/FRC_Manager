import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { TopNav } from "@/components/layout/TopNav";
import { prisma } from "@/lib/prisma";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");

  let robots: { id: string; displayName: string; status: string }[] = [];
  let pendingMemberCount = 0;
  let unreadNotificationCount = 0;

  if (session.user.teamId) {
    const isAdmin = session.user.roles.some((r) => ["HEAD_MENTOR", "INVENTORY_ADMIN"].includes(r));

    const [activeSeason, pendingCount, unreadCount] = await Promise.all([
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
    ]);

    robots = activeSeason?.robots ?? [];
    pendingMemberCount = pendingCount;
    unreadNotificationCount = unreadCount;
  }

  return (
    <div className="min-h-screen bg-[--color-surface]">
      <TopNav
        session={session}
        robots={robots}
        pendingMemberCount={pendingMemberCount}
        unreadNotificationCount={unreadNotificationCount}
      />
      <main className="pt-14">{children}</main>
    </div>
  );
}
