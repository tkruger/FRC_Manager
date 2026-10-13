import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManagePacking } from "@/lib/packing";
import { calendarDayKey } from "@/lib/notify/time";
import { PackSessionClient } from "./PackSessionClient";

export default async function PackSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.teamId) redirect("/dashboard");
  const teamId = session.user.teamId;

  const pack = await prisma.packSession.findFirst({
    where:   { id, teamId },
    include: {
      competition: { select: { name: true, startDate: true, location: true } },
      entries: {
        orderBy: { packedAt: "asc" },
        select: {
          id: true, itemId: true, packedAt: true,
          tool:     { select: { id: true, name: true, assetTag: true } },
          location: { select: { id: true, name: true } },
          packedBy: { select: { name: true } },
        },
      },
    },
  });
  if (!pack) notFound();

  const [items, tools, locations] = await Promise.all([
    prisma.packListItem.findMany({ where: { teamId }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
    prisma.tool.findMany({ where: { teamId, retired: false }, select: { id: true, name: true, assetTag: true }, orderBy: [{ name: "asc" }, { assetTag: "asc" }] }),
    prisma.toolLocation.findMany({ where: { teamId }, select: { id: true, name: true, code: true }, orderBy: { name: "asc" } }),
  ]);

  const when = new Date(`${calendarDayKey(pack.competition.startDate)}T12:00:00Z`)
    .toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <nav className="no-print text-small text-(--color-text-secondary)">
        <Link href="/tools" className="hover:text-(--color-primary)">Tools</Link>
        <span className="mx-2">›</span>
        <Link href="/tools/pack" className="hover:text-(--color-primary)">Pack lists</Link>
        <span className="mx-2">›</span>{pack.competition.name}
      </nav>
      <PackSessionClient
        sessionId={pack.id}
        title={`Packing for ${pack.competition.name}`}
        subtitle={[when, pack.competition.location].filter(Boolean).join(" · ")}
        finished={!!pack.finishedAt}
        manager={canManagePacking(session.user.roles)}
        items={items.map((i) => ({ id: i.id, toolName: i.toolName, label: i.label, quantity: i.quantity, notes: i.notes }))}
        entries={pack.entries.map((e) => ({
          id: e.id, itemId: e.itemId, tool: e.tool, location: e.location,
          packedBy: e.packedBy?.name ?? null, packedAt: e.packedAt.toISOString(),
        }))}
        tools={tools}
        locations={locations}
      />
    </div>
  );
}
