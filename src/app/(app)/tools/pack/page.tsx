import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { canManagePacking, packProgress } from "@/lib/packing";
import { toolGroups } from "../tool-helpers";
import { calendarDayKey, localParts, FALLBACK_TIMEZONE } from "@/lib/notify/time";
import { PackListEditor } from "./PackListEditor";
import { StartPacking } from "./StartPacking";

function dayLabel(d: Date) {
  return new Date(`${calendarDayKey(d)}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export default async function PackListPage() {
  const session = await auth();
  if (!session?.user?.teamId) redirect("/dashboard");
  const teamId = session.user.teamId;
  const manager = canManagePacking(session.user.roles);

  const [team, items, tools, competitions, sessions] = await Promise.all([
    prisma.team.findUnique({ where: { id: teamId }, select: { timezone: true } }),
    prisma.packListItem.findMany({ where: { teamId }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
    prisma.tool.findMany({ where: { teamId, retired: false }, select: { name: true } }),
    prisma.competitionEvent.findMany({
      where:   { season: { teamId, isActive: true } },
      orderBy: { startDate: "asc" },
      select:  { id: true, name: true, startDate: true, endDate: true },
    }),
    prisma.packSession.findMany({
      where:   { teamId },
      orderBy: { startedAt: "desc" },
      take:    20,
      include: {
        competition: { select: { name: true, startDate: true } },
        startedBy:   { select: { name: true } },
        entries:     { select: { itemId: true, tool: { select: { name: true } } } },
      },
    }),
  ]);

  const today = localParts(new Date(), team?.timezone ?? FALLBACK_TIMEZONE).dateKey;
  const groups = toolGroups(tools);
  const open = sessions.filter((s) => !s.finishedAt);
  const done = sessions.filter((s) => s.finishedAt);
  const openByComp = new Map(open.map((s) => [s.competitionId, s.id]));

  function row(s: (typeof sessions)[number]) {
    const p = packProgress(items, s.entries);
    return (
      <li key={s.id}>
        <Link href={`/tools/pack/${s.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 hover:bg-(--color-row-hover-link)">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-(--color-text-primary)">{s.competition.name}</p>
            <p className="text-small text-(--color-text-secondary)">
              {dayLabel(s.competition.startDate)} · started by {s.startedBy?.name ?? "someone"}
              {s.finishedAt ? ` · finished ${s.finishedAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}
            </p>
          </div>
          <Badge variant={p.done ? "success" : s.finishedAt ? "neutral" : "warning"}>
            {p.packed} of {p.needed} packed
          </Badge>
        </Link>
      </li>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <PageHeader
        title="Pack lists"
        help="tools"
        breadcrumb={<><Link href="/tools" className="hover:text-(--color-primary)">Tools</Link><span className="mx-2">›</span>Pack lists</>}
        subtitle="What comes to every competition. Start packing for an event and anyone can help by scanning tools into totes."
      />

      {/* Packing now */}
      <section className="space-y-3">
        <h2 className="text-h2 text-(--color-text-primary)">Packing now</h2>
        {open.length > 0 ? (
          <ul className="card p-0 divide-y divide-(--color-border)">{open.map(row)}</ul>
        ) : (
          <p className="text-body text-(--color-text-secondary)">Nothing is being packed right now.</p>
        )}
        {manager && (
          <StartPacking
            disabled={items.length === 0}
            competitions={competitions.map((c) => ({
              id: c.id,
              label: `${c.name} — ${dayLabel(c.startDate)}${calendarDayKey(c.endDate) < today ? " (past)" : ""}`,
              openSessionId: openByComp.get(c.id) ?? null,
              upcoming: calendarDayKey(c.endDate) >= today,
            }))}
          />
        )}
      </section>

      {/* Master list */}
      <section className="space-y-3">
        <div>
          <h2 className="text-h2 text-(--color-text-primary)">Master pack list</h2>
          <p className="text-small text-(--color-text-secondary)">
            Tool groups are packed by scanning any tool with that name. Other items are ticked off by hand.
          </p>
        </div>
        <PackListEditor
          items={items.map((i) => ({ id: i.id, toolName: i.toolName, label: i.label, quantity: i.quantity, notes: i.notes }))}
          toolNames={groups.names}
          groupSizes={groups.sizes}
          canEdit={manager}
        />
      </section>

      {done.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-h2 text-(--color-text-primary)">Past packing</h2>
          <ul className="card p-0 divide-y divide-(--color-border)">{done.map(row)}</ul>
        </section>
      )}
    </div>
  );
}
