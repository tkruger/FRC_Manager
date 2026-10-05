import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils";
import { statusBadgeVariant, statusLabel } from "@/lib/procurement-helpers";
import { definitionFor, resolveCurrentStep, availableActions } from "@/lib/workflow/engine";
import { describeCondition, describeRoles, evaluateCondition } from "@/lib/workflow/types";
import { ITEM_STATUSES, ITEM_STATUS_INFO, ORDER_ADMIN_ROLES, STATUS_OVERRIDE_ROLES } from "@/lib/orders/constants";
import { ITEM_ROW_SELECT, toItemRow } from "@/lib/orders/rows";
import { ItemsTable } from "@/components/orders/ItemsTable";
import { HelpLink } from "@/components/HelpLink";
import { RequestActions } from "./RequestActions";
import { RequestTimeline, type TimelineEntry } from "./RequestTimeline";

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.teamId) redirect("/dashboard");

  const order = await prisma.purchaseRequest.findFirst({
    where: { id, season: { teamId: session.user.teamId } },
    include: {
      requestedBy: { select: { name: true } },
      lineItems:   { orderBy: [{ orderNumber: "asc" }, { id: "asc" }], select: ITEM_ROW_SELECT },
      events:      { orderBy: { createdAt: "asc" }, include: { actor: { select: { name: true } } } },
    },
  });
  if (!order) notFound();

  const roles       = session.user.roles;
  const def         = await definitionFor(order.workflowDefinitionId);
  const currentStep = resolveCurrentStep(def, order);
  const actions     = availableActions(def, order, { id: session.user.id, roles });

  // Steps still ahead of the current one, and whether they'll apply to this order
  const currentIndex = currentStep ? def.steps.findIndex((s) => s.key === currentStep.key) : -1;
  const subject = { total: order.estimatedTotal ?? 0, priority: order.priority, subTeam: order.subTeam, budgetCategory: order.budgetCategory };
  const upcoming = currentStep
    ? def.steps.slice(currentIndex + 1).map((s) => ({
        name: s.name, who: describeRoles(s.roles),
        willSkip: !evaluateCondition(s.when, subject), condition: describeCondition(s.when),
      }))
    : [];

  const timeline: TimelineEntry[] = order.events.length > 0
    ? order.events.map((e) => ({
        id: e.id, action: e.action, stepName: e.stepName, actor: e.actor?.name ?? null,
        note: e.note, data: e.data as Record<string, unknown> | null, at: e.createdAt.toISOString(),
      }))
    : [{ id: "legacy", action: "created", stepName: null, actor: order.requestedBy.name,
         note: "Submitted before step-by-step history was recorded.", data: null, at: order.submittedAt.toISOString() }];

  const items = order.lineItems.map(toItemRow);
  const total = items.reduce((s, i) => s + (i.unitCost ?? 0) * i.quantity, 0);
  const counts = ITEM_STATUSES.map((s) => ({ s, n: items.filter((i) => i.status === s).length })).filter((c) => c.n > 0);
  const closed = order.status === "DENIED" || order.status === "CANCELLED";

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <nav className="text-small text-(--color-text-secondary)">
        <Link href="/procurement" className="hover:text-(--color-primary)">Orders</Link>
        <span className="mx-2">›</span>
        <span className="text-(--color-text-primary)">{order.title}</span>
      </nav>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-h1 text-(--color-text-primary) flex items-center gap-2">{order.title} <HelpLink topic="purchasing" /></h1>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <Badge variant={statusBadgeVariant(order.status)}>{statusLabel(order.status)}</Badge>
            {counts.map(({ s, n }) => <Badge key={s} variant={ITEM_STATUS_INFO[s].badge}>{n} {ITEM_STATUS_INFO[s].label.toLowerCase()}</Badge>)}
          </div>
        </div>
        <RequestActions requestId={order.id} actions={actions} />
      </div>

      {currentStep && (
        <div className="card py-3 px-4 border-l-4" style={{ borderLeftColor: "var(--color-warning)" }}>
          <p className="text-sm text-(--color-text-primary)">
            <span className="font-semibold">Waiting on: {currentStep.name}</span>
            <span className="text-(--color-text-secondary)"> — {currentStep.type === "receive" ? "deliveries; anyone can mark items arrived" : describeRoles(currentStep.roles)}</span>
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Requested by", value: order.requestedBy.name },
          { label: "Order date",   value: formatDate(order.submittedAt) },
          { label: "Items",        value: String(items.length) },
          { label: "Total cost",   value: formatCurrency(total) },
        ].map((m) => (
          <div key={m.label} className="card py-3">
            <p className="text-label text-(--color-text-secondary)">{m.label}</p>
            <p className="text-sm font-medium text-(--color-text-primary) mt-0.5">{m.value}</p>
          </div>
        ))}
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-h2 text-(--color-text-primary)">Items</h2>
          <a href={`/api/orders/csv?order=${order.id}`} download>
            <Button size="sm" variant="outline">Export CSV</Button>
          </a>
        </div>
        {closed && (
          <p className="text-small text-(--color-text-secondary)">This order was {order.status.toLowerCase()}; its items won&apos;t be ordered.</p>
        )}
        <ItemsTable
          items={items}
          canTrack={!closed && roles.some((r) => ORDER_ADMIN_ROLES.includes(r))}
          canOverride={!closed && roles.some((r) => STATUS_OVERRIDE_ROLES.includes(r))}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-h2 text-(--color-text-primary)">Progress</h2>
        <RequestTimeline entries={timeline} upcoming={upcoming} />
      </section>
    </div>
  );
}
