import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { TopNav } from "@/components/layout/TopNav";
import { prisma } from "@/lib/prisma";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session) redirect("/login");

  // Load robots for active season (for Robot Selector)
  let robots: { id: string; displayName: string; status: string }[] = [];
  if (session.user.teamId) {
    const activeSeason = await prisma.season.findFirst({
      where: { teamId: session.user.teamId, isActive: true },
      include: {
        robots: {
          where: { archived: false },
          select: { id: true, displayName: true, status: true },
          orderBy: { createdAt: "asc" },
        },
      },
    });
    robots = activeSeason?.robots ?? [];
  }

  return (
    <div className="min-h-screen bg-[--color-surface]">
      <TopNav session={session} robots={robots} />
      <main className="pt-14">
        {children}
      </main>
    </div>
  );
}
