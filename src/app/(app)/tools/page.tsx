import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { AddToolDialog } from "./AddToolDialog";
import { Button } from "@/components/ui/button";
import { ToolsClient } from "./ToolsClient";
import type { ToolRow } from "./tool-helpers";
import { HelpLink } from "@/components/HelpLink";

const TOOL_EDIT_ROLES = ["INVENTORY_ADMIN", "BUILD_LEAD", "TEAM_LEADERSHIP", "HEAD_MENTOR"];

export default async function ToolsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view } = await searchParams;
  const session = await auth();
  if (!session?.user?.teamId) redirect("/dashboard");

  const canEdit = session.user.roles.some((r) => TOOL_EDIT_ROLES.includes(r));

  const [tools, myCerts] = await Promise.all([
    prisma.tool.findMany({
      where:   { teamId: session.user.teamId, retired: false },
      include: {
        checkouts: {
          where:   { returnedAt: null },
          select:  { id: true, userId: true, expectedReturn: true, user: { select: { name: true } } },
          take:    1,
        },
      },
      orderBy: [{ name: "asc" }, { assetTag: "asc" }],
    }),
    prisma.userCertification.findMany({
      where:  { userId: session.user.id, status: "ACTIVE" },
      select: { certName: true },
    }),
  ]);

  const now = new Date();
  const rows: ToolRow[] = tools.map((t) => {
    const c = t.checkouts[0];
    return {
      id: t.id, name: t.name, toolType: t.toolType, space: t.space,
      manufacturer: t.manufacturer, model: t.model, assetTag: t.assetTag,
      homeLocation: t.homeLocation, condition: t.condition,
      requiresCertification: t.requiresCertification, certificationName: t.certificationName,
      maintenanceIntervalDays: t.maintenanceIntervalDays, replacementCost: t.replacementCost,
      notes: t.notes, image: t.image,
      checkout: c ? { id: c.id, userId: c.userId, userName: c.user.name, expectedReturn: c.expectedReturn.toISOString() } : null,
    };
  });

  const checkedOut = rows.filter((t) => t.checkout);
  const overdue    = checkedOut.filter((t) => new Date(t.checkout!.expectedReturn) < now);
  const mine       = checkedOut.filter((t) => t.checkout!.userId === session.user.id);

  const views = [
    { key: undefined,           label: "All tools" },
    { key: "mine",              label: `Mine (${mine.length})` },
    { key: "checked-out",       label: `Checked out (${checkedOut.length})` },
    { key: "overdue",           label: `Overdue (${overdue.length})` },
    { key: "needs-maintenance", label: "Needs maintenance" },
  ];

  const filtered =
    view === "mine"              ? mine :
    view === "checked-out"       ? checkedOut :
    view === "overdue"           ? overdue :
    view === "needs-maintenance" ? rows.filter((t) => ["NEEDS_REPAIR", "OUT_OF_SERVICE", "OUT_FOR_MAINTENANCE"].includes(t.condition)) :
    rows;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-h1 text-(--color-text-primary) flex items-center gap-2">Tools <HelpLink topic="tools" /></h1>
          <p className="text-body text-(--color-text-secondary) mt-0.5">
            {rows.length} tools · {rows.length - checkedOut.length} in the shop
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/tools/scan">
            <Button variant="secondary" size="sm" className="flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75zM6.75 16.5h.75v.75h-.75v-.75zM16.5 6.75h.75v.75h-.75v-.75zM13.5 13.5h.75v.75h-.75v-.75zM13.5 19.5h.75v.75h-.75v-.75zM19.5 13.5h.75v.75h-.75v-.75zM19.5 19.5h.75v.75h-.75v-.75zM16.5 16.5h.75v.75h-.75v-.75z" />
              </svg>
              Scan
            </Button>
          </Link>
          <AddToolDialog />
        </div>
      </div>

      <div className="flex gap-1 border-b border-(--color-border) overflow-x-auto">
        {views.map((v) => (
          <Link key={v.key ?? "all"} href={v.key ? `/tools?view=${v.key}` : "/tools"}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              view === v.key
                ? "border-(--color-primary) text-(--color-primary)"
                : "border-transparent text-(--color-text-secondary) hover:text-(--color-text-primary)"
            }`}>
            {v.label}
          </Link>
        ))}
      </div>

      {overdue.length > 0 && !view && (
        <Link href="/tools?view=overdue" className="block rounded-md bg-(--color-danger)/10 border border-(--color-danger)/20 px-4 py-3">
          <p className="text-sm font-medium text-(--color-danger)">
            {overdue.length} tool{overdue.length !== 1 ? "s" : ""} overdue for return →
          </p>
        </Link>
      )}

      {filtered.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-body text-(--color-text-secondary) mb-4">
            {view ? "Nothing here right now." : "No tools yet."}
          </p>
          {!view && <AddToolDialog />}
        </div>
      ) : (
        <ToolsClient
          tools={filtered}
          canEdit={canEdit}
          currentUserId={session.user.id}
          myCertNames={myCerts.map((c) => c.certName)}
          now={now.getTime()}
        />
      )}
    </div>
  );
}
