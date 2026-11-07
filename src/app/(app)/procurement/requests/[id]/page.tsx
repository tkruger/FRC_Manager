import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { statusBadgeVariant, statusLabel } from "@/lib/procurement-helpers";
import { definitionFor, resolveCurrentStep, availableActions, canEditOrder, canResubmitOrder } from "@/lib/workflow/engine";
import { describeCondition, describeRoles, evaluateCondition } from "@/lib/workflow/types";
import { ITEM_STATUSES, ITEM_STATUS_INFO, ORDER_ADMIN_ROLES, STATUS_OVERRIDE_ROLES } from "@/lib/orders/constants";
import { ITEM_ROW_SELECT, toItemRow } from "@/lib/orders/rows";
import { ItemsTable } from "@/components/orders/ItemsTable";
import { PriceCheckButton } from "@/components/orders/PriceCheckButton";
import { OrderComments } from "@/components/orders/OrderComments";
import { isViewOnly } from "@/lib/access/read-only";
import { PageHeader } from "@/components/PageHeader";
import { RequestActions } from "./RequestActions";
import { unusedBudgetCategories } from "@/lib/budget-unused";
import { RequestTimeline, type TimelineEntry } from "./RequestTimeline";
import { itemRef } from "@/lib/orders/constants";
import { canSetOrderBudget } from "@/lib/orders/spend";
import { OrderBudgetCard } from "./OrderBudgetCard";
import { OrderChargesCard, type Vendor } from "./OrderChargesCard";
import { ChangeHistory } from "@/components/history/ChangeHistory";

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.teamId) redirect("/dashboard");

  const order = await prisma.purchaseRequest.findFirst({
    where: { id, season: { teamId: session.user.teamId } },
    include: {
      requestedBy: { select: { name: true } },
      comments:    { orderBy: { createdAt: "asc" }, select: { id: true, body: true, createdAt: true, authorId: true, author: { select: { name: true, deletedAt: true } } } },
      lineItems:   { orderBy: [{ orderNumber: "asc" }, { id: "asc" }], select: ITEM_ROW_SELECT },
      vendorCharges: { orderBy: [{ createdAt: "asc" }, { id: "asc" }], select: { id: true, vendorName: true, tax: true, shipping: true, vendorOrderNumber: true, items: { select: { id: true } } } },
      events:      { orderBy: { createdAt: "asc" }, include: { actor: { select: { name: true } } } },
    },
  });
  if (!order) notFound();

  const roles       = session.user.roles;
  const def         = await definitionFor(order.workflowDefinitionId);
  const currentStep = resolveCurrentStep(def, order);
  const actions     = availableActions(def, order, { id: session.user.id, roles });
  const canEdit     = canEditOrder(def, order, roles);

  // Budget: each item's category and what's recorded in the budget for this order
  const [budgetLines, expenses] = await Promise.all([
    prisma.purchaseLineItem.findMany({
      where:   { requestId: order.id },
      orderBy: [{ orderNumber: "asc" }, { id: "asc" }],
      select:  { id: true, orderNumber: true, name: true, unitCost: true, quantity: true, budgetCategory: true },
    }),
    prisma.expense.findMany({
      where:   { purchaseRequestId: order.id },
      orderBy: { amount: "desc" },
      select:  { amount: true, isCommitment: true, category: { select: { label: true } } },
    }),
  ]);

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
  // Anyone on the team can mark items arrived; Buyers and captains can set any status
  const canChangeStatus = !closed && !isViewOnly(roles);
  const canCheckPrices = !closed && roles.some((r) => ORDER_ADMIN_ROLES.includes(r)) && order.lineItems.some((l) => (l.status === "QUEUED" || l.status === "TO_ORDER") && l.vendorProductUrl);
  const canResubmit = closed && canResubmitOrder(def, order, { id: session.user.id, roles });

  // Items grouped by vendor (trimmed, any case — as the budget matches them), and each vendor's orders
  // (usually one; more when items were split onto separate orders). Items on none are on the first.
  const vendorKey = (v: string | null | undefined) => (v ?? "").trim().toLowerCase();
  const vendors = new Map<string, Vendor>();
  for (const i of items) {
    const v = vendors.get(vendorKey(i.vendorName)) ?? { name: (i.vendorName ?? "").trim(), items: [], orders: [] };
    v.items.push({ id: i.id, ref: itemRef(i), name: i.name, total: (i.unitCost ?? 0) * i.quantity });
    vendors.set(vendorKey(i.vendorName), v);
  }
  for (const c of order.vendorCharges) {
    const v = vendors.get(vendorKey(c.vendorName));
    if (v) v.orders.push({ id: c.id, orderNumber: c.vendorOrderNumber, tax: c.tax, shipping: c.shipping, itemIds: c.items.map((x) => x.id).filter((id) => v.items.some((it) => it.id === id)) });
  }
  for (const v of vendors.values()) {
    if (v.orders.length === 0) v.orders.push({ id: null, orderNumber: null, tax: 0, shipping: 0, itemIds: [] });
    const placed = new Set(v.orders.flatMap((o) => o.itemIds));
    v.orders[0].itemIds.push(...v.items.filter((it) => !placed.has(it.id)).map((it) => it.id));
  }
  const extras = [...vendors.values()].reduce((s, v) => s + v.orders.reduce((t, o) => t + o.tax + o.shipping, 0), 0);
  const beforeApproval = order.status === "DRAFT" || order.status === "SUBMITTED";

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <PageHeader
        breadcrumb={<><Link href="/procurement" className="hover:text-(--color-primary)">Orders</Link><span className="mx-2">›</span><span className="text-(--color-text-primary)">{order.title}</span></>}
        title={order.title}
        help="purchasing"
        subtitle={
          <div className="flex items-center gap-2 pt-1 flex-wrap">
            <Badge variant={statusBadgeVariant(order.status)}>{statusLabel(order.status)}</Badge>
            {counts.map(({ s, n }) => <Badge key={s} variant={ITEM_STATUS_INFO[s].badge}>{n} {ITEM_STATUS_INFO[s].label.toLowerCase()}</Badge>)}
          </div>
        }
        items={[
          { kind: "share", place: "secondary", label: "Share", path: `/procurement/requests/${order.id}`, title: `Order: ${order.title}` },
          // The decision waiting on this person comes first
          actions.some((a) => a.action === "deny") && { kind: "action", place: "secondary", danger: true, icon: "deny", label: "Deny", action: "order:deny" },
          canEdit && { kind: "link", place: "secondary", icon: "edit", label: "Edit order", href: `/procurement/requests/${order.id}/edit` },
          // Once approved, changing item statuses is the main thing to do with an order
          canChangeStatus && { kind: "link", place: !beforeApproval && !actions.some((a) => a.action === "approve") ? "primary" : "secondary", icon: "status", label: "Change status", href: `/procurement/requests/${order.id}?change=status` },
          actions.some((a) => a.action === "approve") && { kind: "action", place: "primary", label: "Approve", action: "order:approve" },
          canResubmit && { kind: "link", place: "primary", label: "Fix and resubmit", href: `/procurement/requests/${order.id}/edit` },
          // Buyer: prices may have moved since the order was placed
          canCheckPrices && { kind: "action", place: "menu", icon: "refresh", label: "Check prices", action: "order:check-prices" },
          items.length > 0 && { kind: "csv", place: "menu", icon: "download", label: "Export CSV", order: order.id },
          actions.some((a) => a.action === "cancel") && { kind: "action", place: "menu", danger: true, icon: "cancel", label: "Cancel order", action: "order:cancel" },
        ]}
      />

      {/* What the header's Approve / Deny / Cancel and Check prices do */}
      {actions.length > 0 && <RequestActions requestId={order.id} actions={actions} />}
      {canCheckPrices && <PriceCheckButton requestId={order.id} action="order:check-prices" />}

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
          { label: "Total cost",   value: formatCurrency(total + extras), note: extras > 0 ? `incl. ${formatCurrency(extras)} tax & shipping` : undefined },
        ].map((m) => (
          <div key={m.label} className="card py-3">
            <p className="text-label text-(--color-text-secondary)">{m.label}</p>
            <p className="text-sm font-medium text-(--color-text-primary) mt-0.5">{m.value}</p>
            {m.note && <p className="text-xs text-(--color-text-secondary)">{m.note}</p>}
          </div>
        ))}
      </div>

      <section className="space-y-3">
        <h2 className="text-h2 text-(--color-text-primary)">Items</h2>
        {closed && (
          <p className="text-small text-(--color-text-secondary)">
            This order was {order.status.toLowerCase().replace("cancelled", "canceled")}{order.approvalNotes ? <> — &ldquo;{order.approvalNotes}&rdquo;</> : ""}; its items won&apos;t be ordered{canResubmit ? <>. Use <b>Fix and resubmit</b> to correct it and send it for approval again</> : ""}.
          </p>
        )}
        <ItemsTable
          items={items}
          canTrack={!closed && roles.some((r) => ORDER_ADMIN_ROLES.includes(r))}
          canOverride={!closed && roles.some((r) => STATUS_OVERRIDE_ROLES.includes(r))}
          canChange={canChangeStatus}
          modeFromPage
        />
      </section>

      {items.length > 0 && (
        <OrderChargesCard
          requestId={order.id}
          vendors={[...vendors.values()]}
          canChange={!closed && !beforeApproval && roles.some((r) => ORDER_ADMIN_ROLES.includes(r))}
          beforeApproval={beforeApproval}
        />
      )}

      <OrderBudgetCard
        requestId={order.id}
        budgetCategory={order.budgetCategory}
        items={budgetLines.map((l) => ({
          id: l.id, ref: itemRef(l), name: l.name, total: (l.unitCost ?? 0) * l.quantity, budgetCategory: l.budgetCategory,
        }))}
        recorded={expenses.map((e) => ({ label: e.category?.label ?? "Uncategorized", amount: e.amount, committed: e.isCommitment }))}
        canChange={canSetOrderBudget(roles, session.user.id, order, canEdit)}
        unusedCategories={await unusedBudgetCategories(session.user.teamId)}
      />

      <OrderComments
        requestId={order.id}
        comments={order.comments.map((c) => ({ id: c.id, body: c.body, at: c.createdAt.toISOString(), mine: c.authorId === session.user.id, author: !c.author || c.author.deletedAt ? "Former member" : c.author.name }))}
        canComment={!isViewOnly(roles)}
        canModerate={roles.some((r) => STATUS_OVERRIDE_ROLES.includes(r))}
      />

      <section className="space-y-3">
        <h2 className="text-h2 text-(--color-text-primary)">Progress</h2>
        <RequestTimeline entries={timeline} upcoming={upcoming} />
        <ChangeHistory entityType="order" entityId={order.id} />
      </section>
    </div>
  );
}
