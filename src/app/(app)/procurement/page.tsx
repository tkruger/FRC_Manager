import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils";
import { statusBadgeVariant, statusLabel } from "@/lib/procurement-helpers";
import { definitionFor, resolveCurrentStep } from "@/lib/workflow/engine";
import { ITEM_STATUSES, ITEM_STATUS_INFO, ORDER_ADMIN_ROLES } from "@/lib/orders/constants";
import { HelpLink } from "@/components/HelpLink";

const OPEN = ["SUBMITTED", "APPROVED", "ORDERED", "PARTIAL_RECEIVED"] as const;

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view = "open" } = await searchParams;
  const session = await auth();
  if (!session?.user?.teamId) redirect("/dashboard");

  const activeSeason = await prisma.season.findFirst({ where: { teamId: session.user.teamId, isActive: true } });
  if (!activeSeason) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-h1 text-(--color-text-primary) mb-4">Orders</h1>
        <div className="card">
          <p className="text-body text-(--color-text-secondary)">
            No active season. <Link href="/settings/season" className="text-(--color-secondary) hover:underline">Set up a season</Link> first.
          </p>
        </div>
      </div>
    );
  }

  const isAdmin = session.user.roles.some((r) => ORDER_ADMIN_ROLES.includes(r));
  const where = {
    seasonId: activeSeason.id,
    ...(view === "open" ? { status: { in: [...OPEN] } } : {}),
    ...(view === "mine" ? { requestedById: session.user.id } : {}),
  };

  const [orders, itemCounts] = await Promise.all([
    prisma.purchaseRequest.findMany({
      where,
      include: {
        requestedBy: { select: { name: true } },
        lineItems:   { select: { status: true, unitCost: true, quantity: true, vendorName: true } },
      },
      orderBy: { submittedAt: "desc" },
      take: 200,
    }),
    prisma.purchaseLineItem.groupBy({
      by:    ["status"],
      where: { request: { seasonId: activeSeason.id, status: { in: [...OPEN] } } },
      _count: { _all: true },
    }),
  ]);

  // Where each open order is waiting
  const defs = new Map<string | null, Awaited<ReturnType<typeof definitionFor>>>();
  const stepName = async (o: (typeof orders)[number]) => {
    if (!defs.has(o.workflowDefinitionId)) defs.set(o.workflowDefinitionId, await definitionFor(o.workflowDefinitionId));
    return resolveCurrentStep(defs.get(o.workflowDefinitionId)!, o)?.name ?? null;
  };
  const rows = await Promise.all(orders.map(async (o) => ({
    o,
    step:    await stepName(o),
    total:   o.lineItems.reduce((s, i) => s + (i.unitCost ?? 0) * i.quantity, 0),
    vendors: [...new Set(o.lineItems.map((i) => i.vendorName).filter(Boolean))] as string[],
    counts:  ITEM_STATUSES.map((s) => ({ s, n: o.lineItems.filter((i) => i.status === s).length })).filter((c) => c.n > 0),
  })));

  const count = (s: string) => itemCounts.find((c) => c.status === s)?._count._all ?? 0;
  const tabs = [
    { key: "open", label: "Open" },
    { key: "mine", label: "Mine" },
    { key: "all",  label: "All" },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-h1 text-(--color-text-primary) flex items-center gap-2">Orders <HelpLink topic="purchasing" /></h1>
          <p className="text-body text-(--color-text-secondary) mt-1">{activeSeason.name}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isAdmin && <Link href="/procurement/admin"><Button variant="secondary" size="sm">Team Admin</Button></Link>}
          <Link href="/procurement/vendors"><Button variant="outline" size="sm">Vendors</Button></Link>
          <Link href="/procurement/requests/new"><Button size="sm">+ New order</Button></Link>
        </div>
      </div>

      {/* Items across open orders, by status */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {ITEM_STATUSES.map((s) => (
          <div key={s} className="card py-3">
            <p className="text-small text-(--color-text-secondary)">{ITEM_STATUS_INFO[s].label}</p>
            <p className="text-h1 text-(--color-text-primary) mt-0.5">{count(s)}</p>
            <p className="text-xs text-(--color-text-secondary)">{ITEM_STATUS_INFO[s].help}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-1 border-b border-(--color-border)">
        {tabs.map((t) => (
          <Link key={t.key} href={t.key === "open" ? "/procurement" : `/procurement?view=${t.key}`}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              view === t.key ? "border-(--color-primary) text-(--color-primary)" : "border-transparent text-(--color-text-secondary) hover:text-(--color-text-primary)"
            }`}>
            {t.label}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="card text-center py-10">
          <p className="text-body text-(--color-text-secondary) mb-4">{view === "open" ? "No open orders." : "No orders yet."}</p>
          <Link href="/procurement/requests/new"><Button size="sm">+ New order</Button></Link>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {rows.map(({ o, step, total, vendors, counts }) => (
            <Link key={o.id} href={`/procurement/requests/${o.id}`} className="card block space-y-2 hover:border-(--color-primary) transition-colors">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold text-(--color-text-primary)">{o.title}</p>
                <p className="text-sm font-semibold text-(--color-text-primary) whitespace-nowrap">{formatCurrency(total)}</p>
              </div>
              <p className="text-small text-(--color-text-secondary)">
                {o.lineItems.length} item{o.lineItems.length === 1 ? "" : "s"}
                {vendors.length > 0 && ` · ${vendors.slice(0, 3).join(", ")}${vendors.length > 3 ? ` +${vendors.length - 3}` : ""}`}
                {" · "}{o.requestedBy.name} · {formatDate(o.submittedAt)}
              </p>
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant={statusBadgeVariant(o.status)}>{statusLabel(o.status)}</Badge>
                {counts.map(({ s, n }) => <Badge key={s} variant={ITEM_STATUS_INFO[s].badge}>{n} {ITEM_STATUS_INFO[s].label.toLowerCase()}</Badge>)}
              </div>
              {step && <p className="text-xs text-(--color-text-secondary)">Waiting on: {step}</p>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
